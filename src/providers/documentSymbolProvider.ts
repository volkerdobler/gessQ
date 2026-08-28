'use strict';

import * as vscode from 'vscode';
import { parseDocumentSymbols, symbolKindOf } from '../core/symbolIndex';

/**
 * Document symbols for the Outline / breadcrumb views and "Go to Symbol in
 * File" – questions, opennumformats, blocks/screens, macros and action
 * targets, with a precise selection range on the name token.
 */
export class GessQDocumentSymbolProvider
	implements vscode.DocumentSymbolProvider
{
	public provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): vscode.DocumentSymbol[] {
		if (token.isCancellationRequested) {
			return [];
		}
		return parseDocumentSymbols(document).map((s) => {
			const sym = new vscode.DocumentSymbol(
				s.name,
				s.detail,
				symbolKindOf(s.category),
				s.lineRange,
				s.nameRange,
			);
			return sym;
		});
	}
}
