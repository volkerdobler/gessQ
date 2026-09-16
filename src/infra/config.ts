'use strict';

import * as vscode from 'vscode';

const section = () => vscode.workspace.getConfiguration('gessq');

/** `gessq.diagnostics.enable` – master switch for the linter. */
export const diagnosticsEnabled = (): boolean =>
	section().get<boolean>('diagnostics.enable', true);

/** `gessq.hover.enable` – master switch for the GESS Q. hover. */
export const hoverEnabled = (): boolean =>
	section().get<boolean>('hover.enable', true);

/** `gessq.hover.keywords` – glossary hover for language keywords. */
export const hoverKeywordsEnabled = (): boolean =>
	section().get<boolean>('hover.keywords', true);

/** How much a hover shows when pointing at a reference to a workspace name. */
export type HoverReferenceDetail = 'off' | 'summary' | 'definition' | 'full';

/**
 * `gessq.hover.referenceDetail` – `off` (no reference hover), `summary`
 * (name / kind / location + description + link), `definition` (adds a cleaned
 * excerpt of the definition) or `full` (the whole definition, incl.
 * actionblock / javascript / css).
 */
export const hoverReferenceDetail = (): HoverReferenceDetail => {
	const v = section().get<string>('hover.referenceDetail', 'definition');
	return v === 'off' || v === 'summary' || v === 'full' ? v : 'definition';
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
	const v = section().get<string>('codeLens.definitions', 'questions');
	return v === 'off' || v === 'reusable' || v === 'all' ? v : 'questions';
};

/** `gessq.completion.includeWorkspaceSymbols`. */
export const completionIncludesWorkspaceSymbols = (): boolean =>
	section().get<boolean>('completion.includeWorkspaceSymbols', true);

/** How readily completions pop up on their own vs. only on explicit invoke. */
export type CompletionAutoTrigger = 'off' | 'trigger' | 'full';

/**
 * `gessq.completion.autoTrigger` – `off` (default): only an explicit invoke
 * (Ctrl+Space) returns completions. `trigger`: also right after `#`/`@`/`&`
 * (not a space). `full`: also right after a space. An explicit invoke always
 * works, regardless of this setting.
 */
export const completionAutoTrigger = (): CompletionAutoTrigger => {
	const v = section().get<string>('completion.autoTrigger', 'off');
	return v === 'trigger' || v === 'full' ? v : 'off';
};

/**
 * `gessq.embeddedLanguages.enable` – forward hover / completion / signature
 * help inside `javascript = "…"` / `jsHandler = "…"` / `css = "…"` blocks to
 * the built-in JS/TS and CSS language services (via a virtual document).
 */
export const embeddedLanguagesEnabled = (): boolean =>
	section().get<boolean>('embeddedLanguages.enable', true);

/**
 * `gessq.releaseNotes.showOnUpdate` – open this version's release notes once
 * after an install / update. The command stays available either way.
 */
export const releaseNotesOnUpdate = (): boolean =>
	section().get<boolean>('releaseNotes.showOnUpdate', true);

/**
 * `gessq.files.exclude` – additional glob excluded from the workspace scan.
 * Empty string means "no extra exclude".
 */
export const filesExcludeGlob = (): string =>
	section().get<string>('files.exclude', '').trim();
