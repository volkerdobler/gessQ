'use strict';

import * as vscode from 'vscode';
import { getCachedScope } from '../core/scope';
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
import { completionIncludesWorkspaceSymbols } from '../infra/config';
import { suppressForEmbedded } from './embeddedLanguage';
import {
	ALL_KEYWORDS,
	CORE_KEYWORDS,
	COMMANDS,
	DIRECTIVES,
	PARAMETERS,
} from '../data/language';

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

const LIST_START = /\b(?:labels|gridlabels|griditems)\b\s*=/i;
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
 * Completion for GESS Q.
 *
 * - suppressed inside comments and strings;
 * - after `#` / `@` only preprocessor directives, after `&` / `#domacro`
 *   only macro names;
 * - otherwise language keywords (from `src/data/language.ts`) plus the symbol
 *   names known to the {@link SymbolIndex}.
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
	): vscode.CompletionItem[] {
		// Inside a `javascript = "…"` / `css = "…"` block the embedded-language
		// provider forwards to the JS/TS / CSS service instead.
		if (suppressForEmbedded(document, position)) {
			return [];
		}

		const scope = getCachedScope(document);
		if (!scope.isNotInComment(position.line, position.character - 1)) {
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
			const questions = this.symbolItems((s) => s.category === 'question');
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
