'use strict';

import * as vscode from 'vscode';
import { getCachedScope, ScopeEnum } from '../core/scope';
import {
	SymbolIndex,
	IndexedSymbol,
	parseDocumentSymbols,
} from '../core/symbolIndex';
import {
	loadGlossary,
	lookupEntry,
	formatEntryMarkdown,
} from '../data/glossary';
import {
	completionAutoTrigger,
	completionIncludesWorkspaceSymbols,
} from '../infra/config';
import { suppressForEmbedded } from './embeddedLanguage';
import {
	ALL_KEYWORDS,
	CORE_KEYWORDS,
	COMMANDS,
	DIRECTIVES,
	PARAMETERS,
} from '../data/language';
import {
	HTML_PARAMETERS,
	HTML_PARAMETER_EXTRAS,
	HTML_PARAMETER_DOC_URL,
	htmlParameterOptions,
	type HtmlParameter,
} from '../data/htmlParameters';

const CORE_SET = new Set(CORE_KEYWORDS);
const PARAM_SET = new Set(PARAMETERS);
const COMMAND_SET = new Set(COMMANDS);

/** Directive names without their leading `#` / `@`. */
const HASH_DIRECTIVES = DIRECTIVES.filter((d) => d.startsWith('#')).map((d) =>
	d.slice(1),
);
const AT_DIRECTIVES = DIRECTIVES.filter((d) => d.startsWith('@')).map((d) =>
	d.slice(1),
);

const K = vscode.CompletionItemKind;

function keywordKind(word: string): vscode.CompletionItemKind {
	if (CORE_SET.has(word)) {
		return K.Keyword;
	}
	if (PARAM_SET.has(word)) {
		return K.Property;
	}
	if (COMMAND_SET.has(word)) {
		return K.Function;
	}
	return K.Keyword;
}

const SYMBOL_KIND: Record<
	IndexedSymbol['category'],
	vscode.CompletionItemKind
> = {
	question: K.Function,
	definition: K.Property,
	block: K.Module,
	macro: K.Constant,
	action: K.Variable,
	array: K.Variable,
	quota: K.Variable,
};

/** Attributes a label / label group may carry inside a `labels=` list. */
export const LABEL_ATTRIBUTES = [
	'always',
	'anchortext',
	'exportlabel',
	'fixed',
	'flt',
	'format',
	'missing',
	'open',
	'random',
	'restrict',
	'single',
] as const;

/** Structuring keywords that may appear inside a `labels=` list. */
export const LABEL_STRUCTURE = ['group', 'splitcolumn', 'text'] as const;

type Ctx =
	| { kind: 'hashDirective' }
	| { kind: 'atDirective' }
	| { kind: 'macroRef' }
	| { kind: 'renderingValue' }
	| { kind: 'labelRef'; question: string }
	| { kind: 'default' };

/** Decide what to offer from the text left of the cursor. */
export function detectContext(linePrefix: string): Ctx {
	if (/\brendering\s*=\s*"?\w*$/i.test(linePrefix)) {
		return { kind: 'renderingValue' };
	}
	if (/(?:^|[^&])&\w*$/.test(linePrefix)) {
		return { kind: 'macroRef' };
	}
	if (/#domacro\s+\w*$/i.test(linePrefix)) {
		return { kind: 'macroRef' };
	}
	if (/(?:^|\s)#\w*$/.test(linePrefix)) {
		return { kind: 'hashDirective' };
	}
	if (/(?:^|\s)@\w*$/.test(linePrefix)) {
		return { kind: 'atDirective' };
	}
	const q = labelReferenceQuestion(linePrefix);
	if (q) {
		return { kind: 'labelRef', question: q };
	}
	return { kind: 'default' };
}

/**
 * When the cursor sits where an *answer code of a specific question* is
 * expected – right after `QNAME.` or after `QNAME eq|ne|le|ge|lt|gt` – return
 * that question's name, else `undefined`.
 */
export function labelReferenceQuestion(linePrefix: string): string | undefined {
	const dot = /(?:^|[^\w.])([A-Za-z_]\w*)\s*\.\s*\d*$/.exec(linePrefix);
	if (dot) {
		return dot[1];
	}
	const cmp =
		/(?:^|[^\w.])([A-Za-z_]\w*)\s+(?:eq|ne|le|ge|lt|gt)\s+\[?\s*\d*$/i.exec(
			linePrefix,
		);
	return cmp ? cmp[1] : undefined;
}

/** Also used by `formattingProvider.ts` to exempt list content from reindent. */
export const LIST_START = /\b(?:labels|gridlabels|griditems)\b\s*=/i;
const LIST_COPY = /\b(?:labels|gridlabels|griditems)\b\s+copy\b/i;
const NEXT_DEF =
	/^\s*(?:singleq|multiq|singlegridq|multigridq|openq|textq|numq|gnumq|passwdq|uploadq|group|sliderq|compute|array|vararray|textelement|textarray|intrandom|databaseconnection|opennumformat|quotavar|quotagroup|block|screen|#\w+)\b/i;

/**
 * Walk up from `position` to decide whether the cursor is inside a
 * `labels=` / `gridlabels=` / `griditems=` list (so label attributes, not
 * question keywords, are the useful completions). The scan ends at the first
 * of: the list opener (→ inside), a `… copy X`, a new definition, or a
 * statement-terminating `;` in code (→ outside).
 */
export function isInLabelList(
	document: vscode.TextDocument,
	position: vscode.Position,
): boolean {
	const scope = getCachedScope(document);
	const from = Math.max(0, position.line - 200);

	const codeSemicolonAfter = (line: number, text: string, min: number) => {
		for (let c = Math.max(0, min); c < text.length; c++) {
			if (
				text[c] === ';' &&
				scope.isNotInComment(line, c) &&
				!scope.isString(line, c)
			) {
				return true;
			}
		}
		return false;
	};

	for (let i = position.line; i >= from; i--) {
		const full = document.lineAt(i).text;
		const text =
			i === position.line ? full.slice(0, position.character) : full;

		const at = text.search(LIST_START);
		if (at >= 0 && scope.isNotInComment(i, at)) {
			// Inside the list only if it hasn't been closed by a `;` yet.
			return !codeSemicolonAfter(i, text, at);
		}
		if (i === position.line) {
			continue;
		}
		if (LIST_COPY.test(text)) {
			return false;
		}
		if (NEXT_DEF.test(text) && scope.isNotInComment(i, 0)) {
			return false;
		}
		if (codeSemicolonAfter(i, text, 0)) {
			return false;
		}
	}
	return false;
}

/**
 * When `position` is inside an `HTML{ … }` block, the text of the current
 * parameter statement left of the cursor (since the last `;` or the `{`),
 * else `undefined`. Walks back over code only – comments and strings are
 * skipped – and gives up after 200 lines.
 */
export function htmlBlockStatement(
	document: vscode.TextDocument,
	position: vscode.Position,
): string | undefined {
	const scope = getCachedScope(document);
	const from = Math.max(0, position.line - 200);
	let depth = 0;
	let stmt: vscode.Position | undefined;

	for (let line = position.line; line >= from; line--) {
		const text = document.lineAt(line).text;
		const end = line === position.line ? position.character : text.length;
		for (let ch = end - 1; ch >= 0; ch--) {
			if (scope.getScope(line, ch) !== ScopeEnum.normal) {
				continue;
			}
			const c = text[ch];
			if (c === '}') {
				depth++;
			} else if (c === '{') {
				if (depth > 0) {
					depth--;
					continue;
				}
				if (!/\bhtml\s*$/i.test(text.slice(0, ch))) {
					return undefined; // some other `{ … }`, e.g. an action block
				}
				stmt ??= new vscode.Position(line, ch + 1);
				return textBetween(document, stmt, position);
			} else if (c === ';' && depth === 0) {
				stmt ??= new vscode.Position(line, ch + 1);
			}
		}
	}
	return undefined;
}

function textBetween(
	document: vscode.TextDocument,
	from: vscode.Position,
	to: vscode.Position,
): string {
	const parts: string[] = [];
	for (let line = from.line; line <= to.line; line++) {
		const text = document.lineAt(line).text;
		parts.push(
			text.slice(
				line === from.line ? from.character : 0,
				line === to.line ? to.character : text.length,
			),
		);
	}
	return parts.join('\n');
}

/** Escape text for a snippet placeholder (`${1:…}`) or choice (`${1|…|}`). */
const snippetEscape = (s: string) => s.replace(/[$}\\,|]/g, '\\$&');

/**
 * The documented default as a value that can be inserted, or `''` when there
 * is none worth pre-filling (`""` = empty, "unendlich", no default at all).
 */
function insertableDefault(p: HtmlParameter): string {
	const d = p.default;
	if (d === undefined || d === '""') {
		return '';
	}
	if (p.value.kind === 'number' && !/^\d+$/.test(d)) {
		return '';
	}
	return d;
}

/** A choice with the default (if it is one of the options) first. */
function choiceDefaultFirst(
	options: readonly string[],
	def: string | undefined,
): string[] {
	return def !== undefined && options.includes(def)
		? [def, ...options.filter((o) => o !== def)]
		: [...options];
}

/**
 * `Name = ${1|no,yes|};` etc. – the value part follows the documented type
 * and is pre-filled with the default, selected: typing replaces it, Tab
 * keeps it. In a choice the default is the first, pre-selected option.
 */
function htmlParameterSnippet(p: HtmlParameter): string {
	const def = snippetEscape(insertableDefault(p));
	const choice = (options: readonly string[]) =>
		`\${1|${choiceDefaultFirst(options, p.default).map(snippetEscape).join(',')}|}`;
	switch (p.value.kind) {
		case 'yesno':
			return `${p.name} = ${choice(['yes', 'no'])};`;
		case 'text':
			return `${p.name} = "\${1:${def}}";`;
		case 'cssLayout':
			return `${p.name} = "\${1}", \${2:2};`;
		case 'choice': {
			const c = choice(p.value.options);
			return `${p.name} = ${p.value.quoted ? `"${c}"` : c};`;
		}
		default:
			return `${p.name} = \${1:${def}};`;
	}
}

function htmlParameterDoc(p: HtmlParameter): vscode.MarkdownString {
	const lines = [`**${p.name}** – ${p.summary}`];
	const opts = htmlParameterOptions(p.name);
	if (opts) {
		lines.push('', `Optionen: \`${opts.options.join(' | ')}\``);
	}
	if (p.default !== undefined) {
		lines.push('', `Default: \`${p.default}\``);
	}
	lines.push('', `[Handbuch](${HTML_PARAMETER_DOC_URL}#${p.anchor})`);
	return new vscode.MarkdownString(lines.join('\n'));
}

/**
 * Completions inside `HTML{ … }`: parameter names at the start of a
 * statement (inserted as `Name = …;` unless an `=` already follows), the
 * value options after `Name =`.
 */
export function htmlBlockItems(
	statement: string,
	lineSuffix: string,
): vscode.CompletionItem[] {
	const value = /^\s*([\w]+)\s*=\s*"?\w*$/.exec(statement);
	if (value) {
		const opts = htmlParameterOptions(value[1]);
		const def = HTML_PARAMETERS.find(
			(p) => p.name.toLowerCase() === value[1].toLowerCase(),
		)?.default;
		return (opts?.options ?? []).map((o) => {
			const it = item(o, K.EnumMember, value[1]);
			if (o === def) {
				it.detail = `${value[1]} (Default)`;
				it.preselect = true;
			}
			return it;
		});
	}
	if (!/^\s*\w*$/.test(statement)) {
		return [];
	}
	const hasAssign = /^\w*\s*=/.test(lineSuffix);
	const out: vscode.CompletionItem[] = [];
	for (const p of HTML_PARAMETERS) {
		const it = item(p.name, K.Property, 'HTML-Parameter');
		it.sortText = '0' + p.name.toLowerCase();
		it.documentation = htmlParameterDoc(p);
		if (!hasAssign) {
			it.insertText = new vscode.SnippetString(htmlParameterSnippet(p));
		}
		out.push(it);
	}
	for (const p of HTML_PARAMETER_EXTRAS) {
		const it = item(p.name, K.Property, 'HTML-Parameter');
		it.sortText = '1' + p.name.toLowerCase();
		if (!hasAssign) {
			it.insertText = new vscode.SnippetString(
				p.options
					? `${p.name} = \${1|${p.options.join(',')}|};`
					: `${p.name} = $1;`,
			);
		}
		out.push(it);
	}
	return out;
}

/**
 * Whether `gessq.completion.autoTrigger` allows completions for this
 * request: an explicit invoke (Ctrl+Space) or a re-query for an incomplete
 * list always does; a `#`/`@`/`&`/space trigger character only does at
 * `trigger` (non-space) or `full` (anything, incl. space); `off` suppresses
 * every non-invoke trigger.
 */
export function autoTriggerAllows(context: vscode.CompletionContext): boolean {
	if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter) {
		return true;
	}
	const mode = completionAutoTrigger();
	if (mode === 'full') {
		return true;
	}
	if (mode === 'trigger') {
		return context.triggerCharacter !== ' ';
	}
	return false;
}

/**
 * Completion for GESS Q.
 *
 * - suppressed inside comments and strings;
 * - after `#` / `@` only preprocessor directives, after `&` / `#domacro`
 *   only macro names;
 * - otherwise language keywords (from `src/data/language.ts`) plus the symbol
 *   names known to the {@link SymbolIndex}.
 * - how readily this pops up on its own (vs. only on an explicit Ctrl+Space
 *   invoke, which always works) is governed by `gessq.completion.autoTrigger`
 *   – see {@link autoTriggerAllows}; plain typing is additionally governed by
 *   the `[gessq]` `editor.quickSuggestions: false` default.
 *
 * `resolveCompletionItem` lazily attaches glossary documentation.
 */
export class GessQCompletionProvider implements vscode.CompletionItemProvider {
	constructor(
		private readonly index: SymbolIndex,
		private readonly extensionUri: vscode.Uri,
	) {}

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token?: vscode.CancellationToken,
		context: vscode.CompletionContext = {
			triggerKind: vscode.CompletionTriggerKind.Invoke,
			triggerCharacter: undefined,
		},
	): vscode.CompletionItem[] {
		if (!autoTriggerAllows(context)) {
			return [];
		}

		// Inside a `javascript = "…"` / `css = "…"` block the embedded-language
		// provider forwards to the JS/TS / CSS service instead.
		if (suppressForEmbedded(document, position)) {
			return [];
		}

		const scope = getCachedScope(document);
		const before = scope.getScopeBefore(position.line, position.character);
		if (before !== ScopeEnum.normal && before !== ScopeEnum.string) {
			return [];
		}

		const linePrefix = document
			.lineAt(position.line)
			.text.slice(0, position.character);
		const ctx = detectContext(linePrefix);

		if (ctx.kind === 'hashDirective') {
			return HASH_DIRECTIVES.map((d) => item(d, K.Keyword, 'directive'));
		}
		if (ctx.kind === 'atDirective') {
			return AT_DIRECTIVES.map((d) => item(d, K.Keyword, 'directive'));
		}
		if (ctx.kind === 'macroRef') {
			return this.symbolItems((s) => s.category === 'macro');
		}
		if (ctx.kind === 'renderingValue') {
			return ['html', 'thymeleaf'].map((v) =>
				item(v, K.Constant, 'rendering'),
			);
		}
		if (ctx.kind === 'labelRef') {
			const codes = this.labelCodeItems(document, ctx.question);
			if (codes.length > 0) {
				return codes;
			}
			// Unknown question / no labels – fall through to the default list.
		}

		const htmlStatement = htmlBlockStatement(document, position);
		if (htmlStatement !== undefined) {
			return htmlBlockItems(
				htmlStatement,
				document.lineAt(position.line).text.slice(position.character),
			);
		}

		if (isInLabelList(document, position)) {
			return this.labelListItems();
		}

		const items = ALL_KEYWORDS.map((kw) =>
			item(kw, keywordKind(kw), 'GESS Q.'),
		);
		if (completionIncludesWorkspaceSymbols()) {
			items.push(...this.symbolItems());
		}
		return items;
	}

	/** Answer-code completions for a `QNAME.` / `QNAME eq …` reference. */
	private labelCodeItems(
		document: vscode.TextDocument,
		question: string,
	): vscode.CompletionItem[] {
		const lower = question.toLowerCase();
		const sym =
			parseDocumentSymbols(document).find(
				(s) => s.lower === lower && s.labels,
			) ?? this.index.definitionsOf(question).find((s) => s.labels);
		if (!sym?.labels) {
			return [];
		}
		return sym.labels.map((l) => {
			const it = new vscode.CompletionItem(l.code, K.EnumMember);
			it.detail = l.text;
			it.documentation = new vscode.MarkdownString(
				'`' + sym.name + '` – Code **' + l.code + '**: ' + l.text,
			);
			// Keep the codes in numeric order, before anything else.
			it.sortText = '0' + l.code.padStart(10, '0');
			it.filterText = l.code + ' ' + l.text;
			return it;
		});
	}

	/** Label attributes + structuring keywords for a `labels=` list. */
	private labelListItems(): vscode.CompletionItem[] {
		const out: vscode.CompletionItem[] = [];
		for (const a of LABEL_ATTRIBUTES) {
			const it = item(a, K.Keyword, 'label attribute');
			it.sortText = '0' + a;
			out.push(it);
		}
		for (const s of LABEL_STRUCTURE) {
			const it = item(s, K.Keyword, 'label structure');
			it.sortText = '1' + s;
			out.push(it);
		}
		if (completionIncludesWorkspaceSymbols()) {
			const questions = this.symbolItems(
				(s) => s.category === 'question',
			);
			for (const it of questions) {
				it.sortText = '2' + String(it.label);
				out.push(it);
			}
		}
		return out;
	}

	public async resolveCompletionItem(
		it: vscode.CompletionItem,
		token: vscode.CancellationToken,
	): Promise<vscode.CompletionItem> {
		if (it.documentation) {
			return it;
		}
		const label = typeof it.label === 'string' ? it.label : it.label.label;
		const glossary = await loadGlossary(this.extensionUri);
		if (token.isCancellationRequested) {
			return it;
		}
		const entry = lookupEntry(glossary, label);
		if (entry) {
			it.documentation = new vscode.MarkdownString(
				formatEntryMarkdown(label, entry),
			);
		}
		return it;
	}

	private symbolItems(
		filter: (s: IndexedSymbol) => boolean = () => true,
	): vscode.CompletionItem[] {
		const out: vscode.CompletionItem[] = [];
		const seen = new Set<string>();
		for (const s of this.index.match('')) {
			if (!filter(s) || seen.has(s.lower)) {
				continue;
			}
			seen.add(s.lower);
			const it = item(s.name, SYMBOL_KIND[s.category], s.category);
			it.documentation = new vscode.MarkdownString(
				'`' +
					s.detail +
					'` – ' +
					vscode.workspace.asRelativePath(s.uri) +
					':' +
					(s.nameRange.start.line + 1),
			);
			out.push(it);
		}
		return out;
	}
}

function item(
	label: string,
	kind: vscode.CompletionItemKind,
	detail: string,
): vscode.CompletionItem {
	const it = new vscode.CompletionItem(label, kind);
	it.detail = detail;
	return it;
}
