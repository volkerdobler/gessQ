'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';

/**
 * "Go to Definition" (F12): looks the word under the cursor up in the
 * workspace {@link SymbolIndex}, plus a fresh parse of the current document
 * so unsaved definitions are found too.
 */
export class GessQDefinitionProvider implements vscode.DefinitionProvider {
	constructor(private readonly index: SymbolIndex) {}

	public async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Location[] | undefined> {
		const [found, word] = getWordAtPosition(document, position);
		if (!found) {
			return undefined;
		}

		await this.index.ready;
		if (token.isCancellationRequested) {
			return undefined;
		}

		const lower = word.toLowerCase();
		const here = document.uri.toString();

		const current = parseDocumentSymbols(document).filter(
			(s) => s.lower === lower,
		);
		const others = this.index
			.definitionsOf(word)
			.filter((s) => s.uri.toString() !== here);

		const hits = [...current, ...others];
		return hits.length
			? hits.map((s) => new vscode.Location(s.uri, s.nameRange))
			: undefined;
	}
}
