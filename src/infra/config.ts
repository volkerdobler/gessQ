'use strict';

import * as vscode from 'vscode';

const section = () => vscode.workspace.getConfiguration('gessq');

/** `gessq.diagnostics.enable` – master switch for the linter. */
export const diagnosticsEnabled = (): boolean =>
	section().get<boolean>('diagnostics.enable', true);

/** `gessq.hover.enable` – master switch for the GESS Q. hover. */
export const hoverEnabled = (): boolean =>
	section().get<boolean>('hover.enable', true);

/** How much a hover shows when pointing at a reference to a workspace name. */
export type HoverReferenceDetail = 'off' | 'summary' | 'definition' | 'full';

/**
 * `gessq.hover.referenceDetail` – `off` (no reference hover), `summary`
 * (name / kind / location + description + link), `definition` (adds a cleaned
 * excerpt of the definition) or `full` (the whole definition, incl.
 * actionblock / javascript / css).
 */
export const hoverReferenceDetail = (): HoverReferenceDetail => {
	const v = section().get<string>('hover.referenceDetail', 'summary');
	return v === 'off' || v === 'definition' || v === 'full' ? v : 'summary';
};

/** Which definitions carry a "N references" CodeLens. */
export type CodeLensDefinitions = 'off' | 'questions' | 'reusable' | 'all';

/**
 * `gessq.codeLens.definitions` – `off` (no lens), `questions` (only question
 * definitions), `reusable` (questions + opennumformat / block / screen /
 * #macro / quotavar) or `all` (also compute / array / textelement / … –
 * everything except `set`/`load` assignment targets).
 */
export const codeLensDefinitions = (): CodeLensDefinitions => {
	const v = section().get<string>('codeLens.definitions', 'reusable');
	return v === 'off' || v === 'questions' || v === 'all' ? v : 'reusable';
};

/** `gessq.completion.includeWorkspaceSymbols`. */
export const completionIncludesWorkspaceSymbols = (): boolean =>
	section().get<boolean>('completion.includeWorkspaceSymbols', true);

/**
 * `gessq.files.exclude` – additional glob excluded from the workspace scan.
 * Empty string means "no extra exclude".
 */
export const filesExcludeGlob = (): string =>
	section().get<string>('files.exclude', '').trim();
