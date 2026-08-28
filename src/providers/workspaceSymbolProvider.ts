'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as parser from '../core/parser';
import { isNotInCommentAt } from '../core/scope';
import {
	getAllFilenamesInDirectory,
	fixDriveCasingInWindows,
} from '../infra/fsUtils';
import { getWorkspaceFolderPath } from '../infra/vscodeUtils';

const constTokenVarNameRest = parser.constTokenVarNameRest;

/**
 * Workspace symbol provider ("Go to Symbol in Workspace", Ctrl+T): scans all
 * `.q` files for questions, definitions, blocks, checks, asserts, action
 * blocks and macros matching the query.
 */
export class GessQWorkspaceSymbolProvider
	implements vscode.WorkspaceSymbolProvider
{
	public provideWorkspaceSymbols(
		query: string,
		_token: vscode.CancellationToken,
	): Thenable<vscode.SymbolInformation[]> {
		const symbols: vscode.SymbolInformation[] = [];

		if (query.length > 0) {
			query = '(' + query + constTokenVarNameRest + ')';
		}

		const questionDefRe = parser.questionDefRe(query);
		const definitionDefRe = parser.definitionDefRe(query);
		const blockDefRe = parser.blockDefRe(query);
		const blockRe = parser.blockRe(query);
		const checkRe = parser.checkRe(query);
		const assertRe = parser.assertRe(query);
		const actionBlockRe = parser.actionBlockRe(query);
		const macroRe = parser.macroDefRe(query);

		const active = vscode.window.activeTextEditor;
		const wsFolder =
			getWorkspaceFolderPath(active && active.document.uri) ||
			fixDriveCasingInWindows(
				path.dirname(active ? active.document.fileName : ''),
			);

		const nameRe = new RegExp(
			'(' + constTokenVarNameRest + ')|("[^"]+")|(.+)',
		);

		return new Promise((resolve) => {
			const files = getAllFilenamesInDirectory(wsFolder, '(q)');

			const pending = files.map((file) =>
				vscode.workspace.openTextDocument(file).then((content) => {
					const push = (
						kind: vscode.SymbolKind,
						container: string,
						range: vscode.Range,
						...tokens: string[]
					): void => {
						for (const token of tokens) {
							let rest = token;
							while (rest && rest.length > 0) {
								rest = rest.trim();
								const m = rest.match(nameRe);
								if (!m) {
									break;
								}
								const name = m[2]
									? m[2].substring(1, m[2].length - 1)
									: m[1]
										? m[1]
										: m[3];
								symbols.push({
									name,
									kind,
									location: new vscode.Location(
										content.uri,
										range,
									),
									containerName: container,
								});
								rest = rest.replace(m[0], '');
							}
						}
					};

					for (let i = 0; i < content.lineCount; i++) {
						const line = content.lineAt(i);
						if (line.text.length === 0) {
							continue;
						}
						const at = (re: RegExp) =>
							isNotInCommentAt(content, i, line.text.search(re));

						let m: RegExpMatchArray | null;
						if (
							at(questionDefRe) &&
							(m = line.text.match(questionDefRe))
						) {
							push(
								vscode.SymbolKind.Function,
								m[1],
								line.range,
								m[2],
							);
						}
						if (
							at(definitionDefRe) &&
							(m = line.text.match(definitionDefRe))
						) {
							push(
								vscode.SymbolKind.Function,
								m[1],
								line.range,
								m[2],
							);
						}
						if (
							at(blockDefRe) &&
							(m = line.text.match(blockDefRe))
						) {
							push(
								vscode.SymbolKind.Function,
								m[1],
								line.range,
								m[2],
							);
						}
						if (at(blockRe) && (m = line.text.match(blockRe))) {
							push(
								vscode.SymbolKind.Function,
								m[1],
								line.range,
								m[2],
							);
						}
						if (at(checkRe) && (m = line.text.match(checkRe))) {
							push(
								vscode.SymbolKind.Operator,
								'check',
								line.range,
								m[1],
							);
						}
						if (at(assertRe) && (m = line.text.match(assertRe))) {
							push(
								vscode.SymbolKind.Operator,
								'assertion',
								line.range,
								m[1],
							);
						}
						if (
							at(actionBlockRe) &&
							(m = line.text.match(actionBlockRe))
						) {
							push(
								vscode.SymbolKind.Operator,
								m[1],
								line.range,
								m[2],
							);
						}
						if (at(macroRe) && (m = line.text.match(macroRe))) {
							push(
								vscode.SymbolKind.Variable,
								'macro',
								line.range,
								m[2],
							);
						}
					}
				}),
			);

			Promise.allSettled(pending).then(() => resolve(symbols));
		});
	}
}
