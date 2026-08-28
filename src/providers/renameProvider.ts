'use strict';

import * as vscode from 'vscode';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';
import { findReferences } from '../core/symbolSearch';

/**
 * Workspace-wide rename for gessQ symbols (questions, opennumformats,
 * blocks/screens, macros, action targets). Only offered when the identifier
 * under the cursor is a known symbol.
 */
export class GessQRenameProvider implements vscode.RenameProvider {
	constructor(private readonly index: SymbolIndex) {}

	public async prepareRename(
		document: vscode.TextDocument,
		position: vscode.Position,
	): Promise<vscode.Range> {
		const range = document.getWordRangeAtPosition(position);
		if (!range) {
			throw new Error('You cannot rename this element.');
		}
		const word = document.getText(range).toLowerCase();
		await this.index.ready;
		const known =
			parseDocumentSymbols(document).some((s) => s.lower === word) ||
			this.index.definitionsOf(word).length > 0;
		if (!known) {
			throw new Error('Rename is only available for gessQ symbols.');
		}
		return range;
	}

	public async provideRenameEdits(
		document: vscode.TextDocument,
		position: vscode.Position,
		newName: string,
		token: vscode.CancellationToken,
	): Promise<vscode.WorkspaceEdit> {
		const range = document.getWordRangeAtPosition(position);
		if (!range) {
			throw new Error('You cannot rename this element.');
		}
		const word = document.getText(range);

		if (!/^[A-Za-zÄÖÜäöüß_$][A-Za-zÄÖÜäöüß0-9_$]*$/.test(newName)) {
			throw new Error('"' + newName + '" is not a valid gessQ name.');
		}

		await this.index.ready;
		if (token.isCancellationRequested) {
			return new vscode.WorkspaceEdit();
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

		const locations = await findReferences(files, word, token);
		const edit = new vscode.WorkspaceEdit();
		for (const loc of locations) {
			edit.replace(loc.uri, loc.range, newName);
		}
		return edit;
	}
}
