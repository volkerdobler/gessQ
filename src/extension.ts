'use strict';

import * as vscode from 'vscode';

import { clearScopeCache } from './core/scope';
import { SymbolIndex, clearParsedSymbolsCache } from './core/symbolIndex';
import {
	setOutputChannel,
	refreshLogLevelFromConfig,
	info,
} from './infra/logger';
import { activateReleaseNotes } from './infra/releaseNotes';
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
	registerRevealLocation,
	registerEmbeddedLanguageSupport,
} from './providers';

const FILE = { language: 'gessq', scheme: 'file' } as const;
const UNTITLED = { language: 'gessq', scheme: 'untitled' } as const;

let symbolIndex: SymbolIndex | undefined;

/**
 * Activate the extension: wire up the Output channel, logging, the workspace
 * symbol index, diagnostics and all language feature providers.
 */
export function activate(context: vscode.ExtensionContext): void {
	const out = vscode.window.createOutputChannel('GESS Q.');
	context.subscriptions.push(out);
	setOutputChannel(out);
	refreshLogLevelFromConfig();
	info('GESS Q. extension activated');

	const index = new SymbolIndex();
	index.start();
	symbolIndex = index;
	context.subscriptions.push(index);

	registerRevealLocation(context);
	registerEmbeddedLanguageSupport(context);
	activateReleaseNotes(context);

	const { extensionUri } = context;
	const formatter = new GessQFormattingProvider();
	const codeLens = new GessQCodeLensProvider(index);
	context.subscriptions.push(codeLens);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('gessq')) {
				refreshLogLevelFromConfig();
			}
			if (e.affectsConfiguration('gessq.files')) {
				index.rebuild();
			}
			if (e.affectsConfiguration('gessq.codeLens')) {
				codeLens.refresh();
			}
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			index.dispose();
			index.start();
		}),
	);

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
		vscode.languages.registerCodeLensProvider(FILE, codeLens),
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

	// Keep the parse caches in sync with the editor.
	const forget = (doc: vscode.TextDocument): void => {
		clearScopeCache(doc);
		clearParsedSymbolsCache(doc);
	};
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => forget(e.document)),
		vscode.workspace.onDidSaveTextDocument(forget),
		vscode.workspace.onDidCloseTextDocument(forget),
	);
}

export function deactivate(): void {
	clearScopeCache();
	clearParsedSymbolsCache();
	symbolIndex?.dispose();
	symbolIndex = undefined;
}
