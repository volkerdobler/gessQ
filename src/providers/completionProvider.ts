'use strict';

import * as vscode from 'vscode';
import { getCachedScope } from '../core/scope';
import { SymbolIndex } from '../core/symbolIndex';
import {
	ALL_KEYWORDS,
	CORE_KEYWORDS,
	DIRECTIVES,
	PARAMETERS,
} from '../data/language';

const DIRECTIVE_SET = new Set(DIRECTIVES.map((d) => d.replace(/^[#@]/, '')));
const CORE_SET = new Set(CORE_KEYWORDS);
const PARAM_SET = new Set(PARAMETERS);

function keywordKind(word: string): vscode.CompletionItemKind {
	if (CORE_SET.has(word)) {
		return vscode.CompletionItemKind.Keyword;
	}
	if (PARAM_SET.has(word)) {
		return vscode.CompletionItemKind.Property;
	}
	if (DIRECTIVE_SET.has(word)) {
		return vscode.CompletionItemKind.Keyword;
	}
	return vscode.CompletionItemKind.Function;
}

const symbolKindToCompletion: Record<string, vscode.CompletionItemKind> = {
	question: vscode.CompletionItemKind.Function,
	definition: vscode.CompletionItemKind.Property,
	block: vscode.CompletionItemKind.Module,
	macro: vscode.CompletionItemKind.Constant,
	action: vscode.CompletionItemKind.Variable,
};

/**
 * Completion for gessQ: language keywords from `src/data/language.ts` plus the
 * symbol names known to the {@link SymbolIndex}. Suppressed inside comments
 * and strings.
 */
export class GessQCompletionProvider implements vscode.CompletionItemProvider {
	constructor(private readonly index: SymbolIndex) {}

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.CompletionItem[] {
		const scope = getCachedScope(document);
		if (!scope.isNotInComment(position.line, position.character - 1)) {
			return [];
		}

		const items: vscode.CompletionItem[] = ALL_KEYWORDS.map((kw) => {
			const it = new vscode.CompletionItem(kw, keywordKind(kw));
			it.detail = 'gessQ';
			return it;
		});

		const seen = new Set<string>();
		for (const s of this.index.match('')) {
			if (seen.has(s.lower)) {
				continue;
			}
			seen.add(s.lower);
			const it = new vscode.CompletionItem(
				s.name,
				symbolKindToCompletion[s.category] ??
					vscode.CompletionItemKind.Variable,
			);
			it.detail = 'gessQ ' + s.category;
			items.push(it);
		}

		return items;
	}
}
