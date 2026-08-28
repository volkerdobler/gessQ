'use strict';

import * as vscode from 'vscode';
import { debug, warn } from '../commons/logger';

const FALLBACK_KEYWORDS = [
	'singleq',
	'multiq',
	'singlegridq',
	'multigridq',
	'openq',
	'textq',
	'numq',
	'gnumq',
	'passwdq',
	'uploadq',
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

let keywordCache: string[] | null = null;

/**
 * Extract candidate keywords from the TextMate grammar shipped with the
 * extension. Cached after the first successful read; falls back to a
 * built-in list on any error.
 * @param extensionUri extension root URI
 */
export async function buildCompletionKeywords(
	extensionUri: vscode.Uri,
): Promise<string[]> {
	if (keywordCache) {
		return keywordCache;
	}

	try {
		const uri = vscode.Uri.joinPath(
			extensionUri,
			'syntaxes',
			'gessq.tmLanguage.json',
		);
		const bytes = await vscode.workspace.fs.readFile(uri);
		const obj = JSON.parse(Buffer.from(bytes).toString('utf8'));
		const set = new Set<string>();
		if (Array.isArray(obj.patterns)) {
			for (const p of obj.patterns) {
				const source = p.match || p.begin || '';
				if (typeof source !== 'string') {
					continue;
				}
				const re = /[A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_$]*/g;
				let mm: RegExpExecArray | null;
				while ((mm = re.exec(source))) {
					const w = mm[0].toLowerCase();
					if (w.length > 1) {
						set.add(w);
					}
				}
			}
		}
		keywordCache =
			set.size > 0 ? Array.from(set).sort() : FALLBACK_KEYWORDS;
		debug('completion: ' + keywordCache.length + ' keywords from grammar');
	} catch (e) {
		warn('completion: grammar not readable, using fallback list – ' + e);
		keywordCache = FALLBACK_KEYWORDS;
	}
	return keywordCache;
}

/**
 * Completion provider for gessQ keywords.
 */
export class GessQCompletionProvider implements vscode.CompletionItemProvider {
	constructor(private readonly extensionUri: vscode.Uri) {}

	public async provideCompletionItems(
		_document: vscode.TextDocument,
		_position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): Promise<vscode.CompletionItem[]> {
		const keywords = await buildCompletionKeywords(this.extensionUri);
		return keywords.map((kw) => {
			const it = new vscode.CompletionItem(
				kw,
				vscode.CompletionItemKind.Keyword,
			);
			it.detail = 'gessQ keyword';
			return it;
		});
	}
}
