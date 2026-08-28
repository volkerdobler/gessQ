'use strict';

import * as vscode from 'vscode';
import { SymbolIndex, symbolKindOf } from '../core/symbolIndex';

/**
 * "Go to Symbol in Workspace" (Ctrl+T): serves gessQ definitions (questions,
 * opennumformats, blocks/screens, macros, action targets) straight from the
 * {@link SymbolIndex}.
 */
export class GessQWorkspaceSymbolProvider
	implements vscode.WorkspaceSymbolProvider
{
	constructor(private readonly index: SymbolIndex) {}

	public async provideWorkspaceSymbols(
		query: string,
		token: vscode.CancellationToken,
	): Promise<vscode.SymbolInformation[]> {
		await this.index.ready;
		if (token.isCancellationRequested) {
			return [];
		}

		return this.index
			.match(query)
			.map(
				(s) =>
					new vscode.SymbolInformation(
						s.name,
						symbolKindOf(s.category),
						s.detail,
						new vscode.Location(s.uri, s.nameRange),
					),
			);
	}
}
