'use strict';

import * as vscode from 'vscode';

import { clearScopeCache } from './core/scope';
import { SymbolIndex } from './core/symbolIndex';
import {
	setOutputChannel,
	refreshLogLevelFromConfig,
	info,
} from './infra/logger';
import {
	GessQCompletionProvider,
	GessQHoverProvider,
	GessQSignatureProvider,
	GessQDefinitionProvider,
	GessQReferenceProvider,
	GessQDocumentSymbolProvider,
	GessQWorkspaceSymbolProvider,
	GessQFoldingRangeProvider,
} from './providers';

const FILE = { language: 'gessq', scheme: 'file' } as const;

let symbolIndex: SymbolIndex | undefined;

/**
 * Activate the extension: wire up the Output channel, logging, the workspace
 * symbol index and all language feature providers.
 */
export function activate(context: vscode.ExtensionContext): void {
	const out = vscode.window.createOutputChannel('gessQ');
	context.subscriptions.push(out);
	setOutputChannel(out);
	refreshLogLevelFromConfig();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('gessq')) {
				refreshLogLevelFromConfig();
			}
		}),
	);

	info('gessQ extension activated');

	const index = new SymbolIndex();
	index.start();
	symbolIndex = index;
	context.subscriptions.push(index);
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			index.dispose();
			index.start();
		}),
	);

	const { extensionUri } = context;

	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider(
			FILE,
			new GessQDocumentSymbolProvider(),
		),
		vscode.languages.registerDefinitionProvider(
			FILE,
			new GessQDefinitionProvider(index),
		),
		vscode.languages.registerReferenceProvider(
			FILE,
			new GessQReferenceProvider(index),
		),
		vscode.languages.registerWorkspaceSymbolProvider(
			new GessQWorkspaceSymbolProvider(index),
		),
		vscode.languages.registerFoldingRangeProvider(
			FILE,
			new GessQFoldingRangeProvider(),
		),
		vscode.languages.registerCompletionItemProvider(
			FILE,
			new GessQCompletionProvider(index, extensionUri),
			'#',
			'@',
			'&',
			' ',
		),
		vscode.languages.registerHoverProvider(
			[FILE, { language: 'gessq', scheme: 'untitled' }],
			new GessQHoverProvider(extensionUri),
		),
		vscode.languages.registerSignatureHelpProvider(
			FILE,
			new GessQSignatureProvider(extensionUri),
			'(',
			',',
		),
	);

	// Keep the scope cache in sync with the editor.
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) =>
			clearScopeCache(e.document),
		),
		vscode.workspace.onDidSaveTextDocument((doc) => clearScopeCache(doc)),
		vscode.workspace.onDidCloseTextDocument((doc) => clearScopeCache(doc)),
	);
}

export function deactivate(): void {
	clearScopeCache();
	symbolIndex?.dispose();
	symbolIndex = undefined;
}
