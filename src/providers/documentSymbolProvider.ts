'use strict';

import * as vscode from 'vscode';
import * as parser from '../core/parser';
import { isNotInCommentAt } from '../core/scope';

/**
 * Document symbol provider: extracts questions, definitions, blocks and
 * action blocks for the Outline / breadcrumb views and "Go to Symbol in File".
 */
export class GessQDocumentSymbolProvider
	implements vscode.DocumentSymbolProvider
{
	public provideDocumentSymbols(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken,
	): Thenable<vscode.SymbolInformation[]> {
		return new Promise((resolve) => {
			const symbols: vscode.SymbolInformation[] = [];

			const push = (
				kind: vscode.SymbolKind,
				container: string,
				range: vscode.Range,
				...names: string[]
			): void => {
				for (const raw of names) {
					const name = raw.trim();
					if (name.length === 0) {
						continue;
					}
					symbols.push({
						name,
						kind,
						location: new vscode.Location(document.uri, range),
						containerName: container,
					});
				}
			};

			const label = (m: RegExpMatchArray) =>
				m[2] + ' [' + m[1].toLocaleLowerCase() + ']';

			const questionRe = parser.questionDefRe('');
			const definitionRe = parser.definitionDefRe('');
			const blockRe = parser.blockDefRe('');
			const actionBlockRe = parser.actionBlockRe('');

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i);
				if (line.text.length === 0) {
					continue;
				}

				if (
					isNotInCommentAt(document, i, line.text.search(questionRe))
				) {
					const m = line.text.match(questionRe);
					if (m) {
						push(
							vscode.SymbolKind.Function,
							'question',
							line.range,
							label(m),
						);
					}
				}
				if (
					isNotInCommentAt(
						document,
						i,
						line.text.search(definitionRe),
					)
				) {
					const m = line.text.match(definitionRe);
					if (m) {
						push(
							vscode.SymbolKind.Property,
							'definition',
							line.range,
							label(m),
						);
					}
				}
				if (isNotInCommentAt(document, i, line.text.search(blockRe))) {
					const m = line.text.match(blockRe);
					if (m) {
						push(
							vscode.SymbolKind.Module,
							'flow',
							line.range,
							label(m),
						);
					}
				}
				if (
					isNotInCommentAt(
						document,
						i,
						line.text.search(actionBlockRe),
					)
				) {
					const m = line.text.match(actionBlockRe);
					if (m) {
						push(
							vscode.SymbolKind.Variable,
							'action',
							line.range,
							m[2] ? label(m) : '',
							m[3]
								? m[3] + ' [' + m[1].toLocaleLowerCase() + ']'
								: '',
						);
					}
				}
			}

			resolve(symbols);
		});
	}
}
