'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import { SymbolIndex } from '../core/symbolIndex';
import { findReferences } from '../core/symbolSearch';

/**
 * "Find All References" (Shift+F12): scans the `.q` files known to the
 * {@link SymbolIndex} (plus the current document) for whole-word,
 * non-comment occurrences on lines that look like a reference.
 */
export class GessQReferenceProvider implements vscode.ReferenceProvider {
	constructor(private readonly index: SymbolIndex) {}

	public async provideReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		_options: vscode.ReferenceContext,
		token: vscode.CancellationToken,
	): Promise<vscode.Location[]> {
		const [found, word] = getWordAtPosition(document, position);
		if (!found) {
			return [];
		}

		await this.index.ready;
		if (token.isCancellationRequested) {
			return [];
		}

		const seen = new Set<string>();
		const files: vscode.Uri[] = [];
		for (const uri of [document.uri, ...this.index.files()]) {
			const key = uri.toString();
			if (!seen.has(key)) {
				seen.add(key);
				files.push(uri);
			}
		}

		return findReferences(files, word, token);
	}
}
