'use strict';

import * as vscode from 'vscode';

const section = () => vscode.workspace.getConfiguration('gessq');

/** `gessq.diagnostics.enable` – master switch for the linter. */
export const diagnosticsEnabled = (): boolean =>
	section().get<boolean>('diagnostics.enable', true);

/** `gessq.hover.enable` – master switch for the gessQ hover. */
export const hoverEnabled = (): boolean =>
	section().get<boolean>('hover.enable', true);

/**
 * `gessq.codeLens.enable` – show the "N references" lens above every
 * definition.
 */
export const codeLensEnabled = (): boolean =>
	section().get<boolean>('codeLens.enable', true);

/** `gessq.completion.includeWorkspaceSymbols`. */
export const completionIncludesWorkspaceSymbols = (): boolean =>
	section().get<boolean>('completion.includeWorkspaceSymbols', true);

/**
 * `gessq.files.exclude` – additional glob excluded from the workspace scan.
 * Empty string means "no extra exclude".
 */
export const filesExcludeGlob = (): string =>
	section().get<string>('files.exclude', '').trim();
