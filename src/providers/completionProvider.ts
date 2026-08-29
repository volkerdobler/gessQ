'use strict';

import * as vscode from 'vscode';
import { getCachedScope } from '../core/scope';
import { SymbolIndex, IndexedSymbol } from '../core/symbolIndex';
import {
	loadGlossary,
	lookupEntry,
	formatEntryMarkdown,
} from '../data/glossary';
import { completionIncludesWorkspaceSymbols } from '../infra/config';
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

type Ctx =
	| { kind: 'hashDirective' }
	| { kind: 'atDirective' }
	| { kind: 'macroRef' }
	| { kind: 'renderingValue' }
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
	return { kind: 'default' };
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

		const items = ALL_KEYWORDS.map((kw) =>
			item(kw, keywordKind(kw), 'GESS Q.'),
		);
		if (completionIncludesWorkspaceSymbols()) {
			items.push(...this.symbolItems());
		}
		return items;
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
