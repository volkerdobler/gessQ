'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

import { clearScopeCache, isNotInCommentAt } from './components';
import {
	fixDriveCasingInWindows,
	getAllFilenamesInDirectory,
} from './commons/fsUtils';
import { getWordAtPosition } from './commons/vscodeUtils';
import {
	GessQCompletionProvider,
	GessQHoverProvider,
	GessQSignatureProvider,
} from './components';
import * as parser from './commons/parserUtils';
import { setOutputChannel, error as logError, info } from './commons/logger';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * Activate the extension: register providers and event listeners.
 * @param context extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext): any {
	info('Congratulations, your extension "gessQ" is now active!');

	const out = vscode.window.createOutputChannel('gessQ');
	context.subscriptions.push(out);

	// register output channel with logger helper
	setOutputChannel(out);

	const unhandled = (reason: any) => {
		const msg = reason && reason.stack ? reason.stack : String(reason);
		logError('[unhandledRejection] ' + msg);
	};
	process.on('unhandledRejection', unhandled);
	context.subscriptions.push({
		dispose: () => process.removeListener('unhandledRejection', unhandled),
	});

	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider(
			{ language: 'gessq', scheme: 'file' },
			new GessQDocumentSymbolProvider(),
		),
	);

	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(
			{ language: 'gessq', scheme: 'file' },
			new GessQDefinitionProvider(),
		),
	);

	context.subscriptions.push(
		vscode.languages.registerReferenceProvider(
			{ language: 'gessq', scheme: 'file' },
			new GessQReferenceProvider(),
		),
	);

	context.subscriptions.push(
		vscode.languages.registerWorkspaceSymbolProvider(
			new GessQWorkspaceSymbolProvider(),
		),
	);

	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(
			{
				language: 'gessq',
				scheme: 'file',
			},
			new GessQFoldingRangeProvider(),
		),
	);

	// Register completion provider for gessQ
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			{ language: 'gessq', scheme: 'file' },
			new GessQCompletionProvider(context.extensionUri),
			'#',
			'@',
			' ',
		),
	);

	// Register hover provider (support files and untitled editors)
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			[
				{ language: 'gessq', scheme: 'file' },
				{ language: 'gessq', scheme: 'untitled' },
			],
			new GessQHoverProvider(context.extensionUri),
		),
	);

	// Clear scope cache on document changes, saves and closes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => {
			clearScopeCache(e.document);
		}),
	);
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			clearScopeCache(doc);
		}),
	);
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			clearScopeCache(doc);
		}),
	);

	// Signature Help Provider: shows parameter hints for macros/commands
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(
			{ scheme: 'file', language: 'gessq' },
			new GessQSignatureProvider(context.extensionUri),
			'(',
			',',
		),
	);
}

/**
 * Get the workspace folder path for `fileUri`. Falls back to the first workspace folder.
 * @param fileUri optional file URI to locate the containing workspace
 */
function getWorkspaceFolderPath(fileUri?: vscode.Uri): string | undefined {
	if (fileUri) {
		const workspace = vscode.workspace.getWorkspaceFolder(fileUri);
		return workspace
			? fixDriveCasingInWindows(workspace.uri.fsPath)
			: undefined;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length) {
		return fixDriveCasingInWindows(folders[0].uri.fsPath);
	}
	return undefined;
}

const constTokenVarNameRest = parser.constTokenVarNameRest;

// regex factories are provided by parserUtils; use them via `parser`.

/**
 * Search for a definition of `word` inside a single file and return its Location.
 * @param filename absolute path to the file to scan
 * @param word symbol to search for
 */
async function getDefLocationInDocument(
	filename: string,
	word: string,
): Promise<vscode.Location> {
	let locPosition: vscode.Location;

	const questionRegExp = parser.questionDefRe(word);
	const definitionRegExp = parser.definitionDefRe(word);
	const blockRegExp = parser.blockDefRe(word);

	return vscode.workspace.openTextDocument(filename).then((content) => {
		for (let i = 0; i < content.lineCount; i++) {
			const line = content.lineAt(i);
			if (line.text.length === 0) {
				continue;
			}

			if (
				isNotInCommentAt(
					content,
					i,
					line.text.search(questionRegExp),
				) ||
				isNotInCommentAt(
					content,
					i,
					line.text.search(definitionRegExp),
				) ||
				isNotInCommentAt(content, i, line.text.search(blockRegExp))
			) {
				locPosition = new vscode.Location(content.uri, line.range);
			}
		}
		if (!locPosition) {
			return Promise.reject('No definition found');
		}
		return locPosition;
	});
}

/**
 * Collect all Locations referencing `word` in `filename`.
 * @param filename absolute path to the file to scan
 * @param word symbol to search for
 */
async function getAllLocationInDocument(
	filename: string,
	word: string,
): Promise<vscode.Location[]> {
	const locArray: vscode.Location[] = [];

	const questionDefRegExp = parser.questionDefRe(word);
	const definitionDefRegExp = parser.definitionDefRe(word);
	const blockDefRegExp = parser.blockDefRe(word);
	const blockRegExp = parser.blockRe(word);
	const checkRegExp = parser.checkRe(word);
	const assertRegExp = parser.assertRe(word);
	const computeRegExp = parser.computeRe(word);
	const actionBlockRegExp = parser.actionBlockDefRe(word);

	return vscode.workspace.openTextDocument(filename).then((content) => {
		for (let i = 0; i < content.lineCount; i++) {
			const line = content.lineAt(i);
			if (line.text.length === 0) {
				continue;
			}

			if (
				isNotInCommentAt(
					content,
					i,
					line.text.search(questionDefRegExp),
				) ||
				isNotInCommentAt(
					content,
					i,
					line.text.search(definitionDefRegExp),
				) ||
				isNotInCommentAt(
					content,
					i,
					line.text.search(blockDefRegExp),
				) ||
				isNotInCommentAt(content, i, line.text.search(blockRegExp)) ||
				isNotInCommentAt(content, i, line.text.search(checkRegExp)) ||
				isNotInCommentAt(content, i, line.text.search(assertRegExp)) ||
				isNotInCommentAt(content, i, line.text.search(computeRegExp)) ||
				isNotInCommentAt(
					content,
					i,
					line.text.search(actionBlockRegExp),
				)
			) {
				locArray.push(new vscode.Location(content.uri, line.range));
			}
		}
		return locArray;
	});
}

/**
 * Definition provider for gessQ files.
 */
class GessQDefinitionProvider implements vscode.DefinitionProvider {
	/**
	 * Provide the definition Location for the symbol under the cursor.
	 */
	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Thenable<vscode.Location> {
		return new Promise((resolve, reject) => {
			const adjustedPos = getWordAtPosition(document, position);

			if (!adjustedPos[0]) {
				reject('No definition found');
				return;
			}
			const word = adjustedPos[1];

			const wsFolder =
				getWorkspaceFolderPath(document.uri) ||
				fixDriveCasingInWindows(path.dirname(document.fileName));

			const fileNames: string[] = getAllFilenamesInDirectory(
				wsFolder,
				'q',
			);

			if (fileNames.length === 0) {
				reject('No Q-files found');
				return;
			}

			const locations = fileNames.map((file) =>
				getDefLocationInDocument(file, word),
			);
			/**
			 * Handle results from scanning files for a single definition.
			 * @param results results from Promise.allSettled
			 */
			Promise.allSettled(locations).then(function (results) {
				let found: boolean = false;
				results.forEach((r: any) => {
					if (r.status === 'fulfilled' && r.value) {
						resolve(r.value);
						found = true;
					}
				});
				if (!found) {
					reject('No definition found');
				}
			});
		});
	}
}

class GessQReferenceProvider implements vscode.ReferenceProvider {
	/**
	 * Reference provider for gessQ files.
	 */
	/**
	 * Provide all reference Locations for the symbol under the cursor.
	 */
	public provideReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		options: { includeDeclaration: boolean },
		token: vscode.CancellationToken,
	): Thenable<vscode.Location[]> {
		const wordAtPosition = getWordAtPosition(document, position);

		return new Promise((resolve) => {
			if (!wordAtPosition[0]) {
				resolve([]);
				return;
			}
			const word = wordAtPosition[1];

			const loclist: vscode.Location[] = [];

			const wsFolder =
				getWorkspaceFolderPath(document.uri) ||
				fixDriveCasingInWindows(path.dirname(document.fileName));

			const fileNames: string[] = getAllFilenamesInDirectory(
				wsFolder,
				'q',
			);

			const locations = fileNames.map((file) =>
				getAllLocationInDocument(file, word),
			);
			/**
			 * Handle results from scanning files for references.
			 * @param results results from Promise.allSettled
			 */
			Promise.allSettled(locations).then(function (results) {
				results.forEach((r: any) => {
					if (r.status === 'fulfilled' && r.value && r.value[0]) {
						r.value.forEach((arr: any) => loclist.push(arr));
					}
				});
				resolve(loclist);
			});
		});
	}
}

/**
 * Document symbol provider: extracts questions, definitions and blocks.
 */
class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
	/**
	 * Provide document symbols (for Outline and breadcrumb views).
	 */
	public provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): Thenable<vscode.SymbolInformation[]> {
		return new Promise((resolve) => {
			const symbols: vscode.SymbolInformation[] = [];

			/**
			 * Push symbol information for up to three name fields.
			 */
			function spush(
				kind: vscode.SymbolKind,
				container: string,
				m1: string,
				m2: string,
				m3: string,
				uri: vscode.Uri,
				range: vscode.Range,
			): void {
				const varName = new RegExp(
					'(' + constTokenVarNameRest + ')|(' + '"[^"]+"' + ')|(.+)',
				);
				/**
				 * Push a single name into the symbols array when present.
				 */
				function lpush(teststring: string): void {
					if (teststring && teststring.length > 0) {
						teststring = teststring.trim();
						symbols.push({
							name: teststring,
							kind: kind,
							location: new vscode.Location(uri, range),
							containerName: container,
						});
					}
				}

				lpush(m1);
				lpush(m2);
				lpush(m3);
			}

			const questionRegExp = parser.questionDefRe('');
			const definitionRegExp = parser.definitionDefRe('');
			const blockRegExp = parser.blockDefRe('');
			const actionBlockRegExp = parser.actionBlockRe('');

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i);

				if (line.text.length === 0) {
					continue;
				}

				if (
					isNotInCommentAt(
						document,
						i,
						line.text.search(questionRegExp),
					)
				) {
					const lineMatch = line.text.match(questionRegExp);
					if (lineMatch) {
						spush(
							vscode.SymbolKind.Function,
							'question',
							lineMatch[2] +
								' [' +
								lineMatch[1].toLocaleLowerCase() +
								']',
							'',
							'',
							document.uri,
							line.range,
						);
					}
				}
				if (
					isNotInCommentAt(
						document,
						i,
						line.text.search(definitionRegExp),
					)
				) {
					const lineMatch = line.text.match(definitionRegExp);
					if (lineMatch) {
						spush(
							vscode.SymbolKind.Property,
							'definition',
							lineMatch[2] +
								' [' +
								lineMatch[1].toLocaleLowerCase() +
								']',
							'',
							'',
							document.uri,
							line.range,
						);
					}
				}
				if (
					isNotInCommentAt(document, i, line.text.search(blockRegExp))
				) {
					const lineMatch = line.text.match(blockRegExp);
					if (lineMatch) {
						spush(
							vscode.SymbolKind.Module,
							'flow',
							lineMatch[2] +
								' [' +
								lineMatch[1].toLocaleLowerCase() +
								']',
							'',
							'',
							document.uri,
							line.range,
						);
					}
				}
				if (
					isNotInCommentAt(
						document,
						i,
						line.text.search(actionBlockRegExp),
					)
				) {
					const lineMatch = line.text.match(actionBlockRegExp);
					if (lineMatch) {
						spush(
							vscode.SymbolKind.Variable,
							'action',
							lineMatch[2]
								? lineMatch[2] +
										' [' +
										lineMatch[1].toLocaleLowerCase() +
										']'
								: '',
							lineMatch[3]
								? lineMatch[3] +
										' [' +
										lineMatch[1].toLocaleLowerCase() +
										']'
								: '',
							'',
							document.uri,
							line.range,
						);
					}
				}
			}

			resolve(symbols);
		});
	}
}

class GessQWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
	/**
	 * Workspace symbol provider: scans all Q files for matching symbols.
	 */
	/**
	 * Provide workspace symbols matching the query string.
	 */
	public provideWorkspaceSymbols(
		query: string,
		token: vscode.CancellationToken,
	): Thenable<vscode.SymbolInformation[]> {
		const symbols: vscode.SymbolInformation[] = [];

		if (query.length > 0) {
			query = '(' + query + constTokenVarNameRest + ')';
		}

		const questionDefRegExp: RegExp = parser.questionDefRe(query);
		const definitionDefRegExp: RegExp = parser.definitionDefRe(query);
		const blockDefRegExp: RegExp = parser.blockDefRe(query);
		const blockRegExp: RegExp = parser.blockRe(query);
		const checkRegExp: RegExp = parser.checkRe(query);
		const assertRegExp: RegExp = parser.assertRe(query);
		const actionBlockRegExp: RegExp = parser.actionBlockRe(query);
		const macroRegExp: RegExp = parser.macroDefRe(query);

		const wsFolder =
			getWorkspaceFolderPath(
				vscode.window.activeTextEditor &&
					vscode.window.activeTextEditor.document.uri,
			) ||
			fixDriveCasingInWindows(
				path.dirname(
					vscode &&
						vscode.window &&
						vscode.window.activeTextEditor &&
						vscode.window.activeTextEditor.document
						? vscode.window.activeTextEditor.document.fileName
						: '',
				),
			);

		return new Promise((resolve) => {
			getAllFilenamesInDirectory(wsFolder, '(q)').forEach(
				(fileWithPath) => {
					vscode.workspace
						.openTextDocument(fileWithPath)
						/**
						 * Callback invoked with the opened document to extract symbols.
						 * @param content opened TextDocument
						 */
						.then(function (content) {
							/**
							 * Push symbol entries extracted from a file line.
							 */
							function spush(
								kind: vscode.SymbolKind,
								container: string,
								m1: string,
								m2: string,
								m3: string,
								uri: vscode.Uri,
								range: vscode.Range,
							): void {
								const varName = new RegExp(
									'(' +
										constTokenVarNameRest +
										')|(' +
										'"[^"]+"' +
										')|(.+)',
								);

								/**
								 * Extract and push names from a token string.
								 */
								function lpush(teststring: string): void {
									while (
										teststring &&
										teststring.length > 0
									) {
										teststring = teststring.trim();
										const xname = teststring.match(varName);
										if (xname) {
											const pname = xname[2]
												? xname[2].substring(
														1,
														xname[2].length - 1,
													)
												: xname[1]
													? xname[1]
													: xname[3];
											symbols.push({
												name: pname,
												kind: kind,
												location: new vscode.Location(
													uri,
													range,
												),
												containerName: container,
											});
											teststring = teststring.replace(
												xname[0],
												'',
											);
										}
									}
								}

								lpush(m1);
								lpush(m2);
								lpush(m3);
							}

							for (let i = 0; i < content.lineCount; i++) {
								const line = content.lineAt(i);

								if (line.text.length === 0) {
									continue;
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(questionDefRegExp),
									)
								) {
									const lineMatch =
										line.text.match(questionDefRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Function,
											lineMatch[1],
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(definitionDefRegExp),
									)
								) {
									const lineMatch =
										line.text.match(definitionDefRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Function,
											lineMatch[1],
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(blockDefRegExp),
									)
								) {
									const lineMatch =
										line.text.match(blockDefRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Function,
											lineMatch[1],
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(blockRegExp),
									)
								) {
									const lineMatch =
										line.text.match(blockRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Function,
											lineMatch[1],
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(checkRegExp),
									)
								) {
									const lineMatch =
										line.text.match(checkRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Operator,
											'check',
											lineMatch[1],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(assertRegExp),
									)
								) {
									const lineMatch =
										line.text.match(assertRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Operator,
											'assertion',
											lineMatch[1],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(actionBlockRegExp),
									)
								) {
									const lineMatch =
										line.text.match(actionBlockRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Operator,
											lineMatch[1],
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
								if (
									isNotInCommentAt(
										content,
										i,
										line.text.search(macroRegExp),
									)
								) {
									const lineMatch =
										line.text.match(macroRegExp);
									if (lineMatch) {
										spush(
											vscode.SymbolKind.Variable,
											'macro',
											lineMatch[2],
											'',
											'',
											content.uri,
											line.range,
										);
									}
								}
							}
							return symbols;
						})
						.then((result) => {
							resolve(result);
						});
				},
			);
		});
	}
}

class GessQFoldingRangeProvider implements vscode.FoldingRangeProvider {
	/**
	 * Provide folding ranges for the current document.
	 */
	public provideFoldingRanges(
		document: vscode.TextDocument,
		context: vscode.FoldingContext,
		token: vscode.CancellationToken,
	): Thenable<vscode.FoldingRange[]> {
		return new Promise((resolve) => {
			const regions: {
				start: RegExp;
				end: RegExp;
				kind: vscode.FoldingRangeKind;
				len: number;
			}[] = [
				{
					start: /\B#macro\b/i,
					end: /\B#(endmacro|macroend)\b/i,
					kind: vscode.FoldingRangeKind.Region,
					len: 6,
				},
				{
					start: /\B#ifn?def\b/i,
					end: /\B#end(if)?\b/i,
					kind: vscode.FoldingRangeKind.Region,
					len: 4,
				},
				{
					start: /\{/i,
					end: /\}/,
					kind: vscode.FoldingRangeKind.Region,
					len: 1,
				},
				{
					start: /\B\/\*\B/,
					end: /\B\*\/\B/,
					kind: vscode.FoldingRangeKind.Comment,
					len: 2,
				},
			];

			const foldingCollection: {
				start: number;
				end: number;
				kind: vscode.FoldingRangeKind;
			}[] = [];

			let foldingCounter: number = 0;
			let inComment = false;

			for (let l = 0; l < document.lineCount; l++) {
				let curLine = document.lineAt(l).text;

				const posLineComment = curLine.search(/\/\//);
				if (posLineComment > -1) {
					curLine = curLine.slice(0, posLineComment);
					if (curLine.length === 0) {
						continue;
					}
				}
				for (let loop = 0; loop < regions.length; loop++) {
					if (curLine.length === 0) {
						break;
					}

					if (curLine.search(/\}\s*else\s*\{/) > -1) {
						break;
					}
					let posRegionComplete = curLine.search(
						new RegExp(
							regions[loop].start.source +
								'.+?' +
								regions[loop].end.source,
							'i',
						),
					);

					while (posRegionComplete > -1) {
						curLine =
							curLine.slice(
								0,
								curLine.search(regions[loop].start),
							) +
							curLine.slice(
								curLine.search(regions[loop].end) +
									regions[loop].len,
							);
						posRegionComplete = curLine.search(
							new RegExp(
								regions[loop].start.source +
									'.+?' +
									regions[loop].end.source,
								'i',
							),
						);
					}
					const posStart = curLine.search(regions[loop].start);
					if (posStart > -1 && !inComment) {
						foldingCollection.push({
							start: l,
							end: -1,
							kind: regions[loop].kind,
						});
						foldingCounter = foldingCollection.length;
						curLine = curLine.slice(posStart + regions[loop].len);
						inComment =
							regions[loop].kind ===
							vscode.FoldingRangeKind.Comment;
					}
					const posEnd = curLine.search(regions[loop].end);
					if (
						posEnd > -1 &&
						(regions[loop].kind ===
							vscode.FoldingRangeKind.Comment ||
							!inComment)
					) {
						while (
							foldingCounter > 0 &&
							foldingCollection[foldingCounter - 1].end > -1
						) {
							foldingCounter--;
						}
						if (foldingCounter > 0) {
							const endLine =
								l - 1 >
								foldingCollection[foldingCounter - 1].start
									? l - 1
									: l;
							foldingCollection[--foldingCounter].end = endLine;
						}
						curLine = curLine.slice(posEnd + regions[loop].len + 1);
						inComment = false;
					}
				}
			}
			resolve(foldingCollection);
		});
	}
}
