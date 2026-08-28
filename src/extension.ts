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
	GessQDocumentLinkProvider,
	GessQDocumentHighlightProvider,
	GessQRenameProvider,
	GessQCodeLensProvider,
	GessQFormattingProvider,
	DiagnosticsManager,
} from './providers';

const FILE = { language: 'gessq', scheme: 'file' } as const;
const UNTITLED = { language: 'gessq', scheme: 'untitled' } as const;

let symbolIndex: SymbolIndex | undefined;

/**
 * Activate the extension: wire up the Output channel, logging, the workspace
 * symbol index, diagnostics and all language feature providers.
 */
export function activate(context: vscode.ExtensionContext): void {
	const out = vscode.window.createOutputChannel('gessQ');
	context.subscriptions.push(out);
	setOutputChannel(out);
	refreshLogLevelFromConfig();
	info('gessQ extension activated');

	const index = new SymbolIndex();
	index.start();
	symbolIndex = index;
	context.subscriptions.push(index);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('gessq')) {
				refreshLogLevelFromConfig();
			}
			if (e.affectsConfiguration('gessq.files')) {
				index.rebuild();
			}
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			index.dispose();
			index.start();
		}),
	);

	const { extensionUri } = context;
	const formatter = new GessQFormattingProvider();

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
		vscode.languages.registerDocumentLinkProvider(
			FILE,
			new GessQDocumentLinkProvider(),
		),
		vscode.languages.registerDocumentHighlightProvider(
			FILE,
			new GessQDocumentHighlightProvider(),
		),
		vscode.languages.registerRenameProvider(
			FILE,
			new GessQRenameProvider(index),
		),
		vscode.languages.registerCodeLensProvider(
			FILE,
			new GessQCodeLensProvider(index),
		),
		vscode.languages.registerDocumentFormattingEditProvider(
			FILE,
			formatter,
		),
		vscode.languages.registerDocumentRangeFormattingEditProvider(
			FILE,
			formatter,
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
			[FILE, UNTITLED],
			new GessQHoverProvider(extensionUri, index),
		),
		vscode.languages.registerSignatureHelpProvider(
			FILE,
			new GessQSignatureProvider(extensionUri),
			'(',
			',',
		),
	);

	new DiagnosticsManager(index).activate(context);

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
