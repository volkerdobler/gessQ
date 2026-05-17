'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Build completion keyword list by extracting identifiers from the
 * language grammar. Falls back to a built-in list on error.
 */
export function buildCompletionKeywords(): string[] {
	const fallback = [
		'singleq',
		'multiq',
		'singlegridq',
		'multigridq',
		'openq',
		'textq',
		'numq',
		'group',
		'compute',
		'assert',
		'check',
		'set',
		'load',
		'macro',
		'include',
		'block',
		'screen',
		'if',
		'else',
		'for',
		'foreach',
		'array',
		'vararray',
		'open',
		'selectlanguage',
		'repeat',
	];
	try {
		const jsonPath = path.join(
			__dirname,
			'..',
			'syntaxes',
			'gessq.tmLanguage.json',
		);
		const txt = fs.readFileSync(jsonPath, 'utf8');
		const obj = JSON.parse(txt);
		const set = new Set<string>();
		if (Array.isArray(obj.patterns)) {
			for (const p of obj.patterns) {
				const source = p.match || p.begin || '';
				if (typeof source === 'string') {
					const re = /[A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_$]*/g;
					let m: RegExpExecArray | null;
					while ((m = re.exec(source))) {
						const w = m[0].toLowerCase();
						if (w.length > 1) set.add(w);
					}
				}
			}
		}
		if (set.size === 0) return fallback;
		return Array.from(set).sort();
	} catch (e) {
		return fallback;
	}
}

/**
 * Completion provider for gessQ keywords.
 */
export class GessQCompletionProvider implements vscode.CompletionItemProvider {
	/**
	 * Provide completion items for the current document/position.
	 * @param document active text document
	 * @param position cursor position
	 * @param token cancellation token
	 * @param context completion context
	 */
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
		const items: vscode.CompletionItem[] = [];
		// `completionKeywords` will be provided by caller module
		const keywords = buildCompletionKeywords();
		for (const kw of keywords) {
			const it = new vscode.CompletionItem(
				kw,
				vscode.CompletionItemKind.Keyword,
			);
			it.detail = 'gessQ keyword';
			items.push(it);
		}
		return items;
	}
}
