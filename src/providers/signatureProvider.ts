'use strict';

import * as vscode from 'vscode';
import { loadGlossary, type Glossary } from '../data/glossary';
import { suppressForEmbedded } from './embeddedLanguage';

/**
 * Signature Help provider for the GESS Q. language.
 *
 * Uses `manualGlossary.json` (when available) to produce parameter lists for
 * known macros / commands and falls back to heuristics otherwise.
 */
export class GessQSignatureProvider implements vscode.SignatureHelpProvider {
	/**
	 * @param extensionUri extension root URI used to resolve the glossary.
	 */
	constructor(private readonly extensionUri: vscode.Uri) {}

	public async provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.SignatureHelpContext,
	): Promise<vscode.SignatureHelp | null> {
		// Inside a `javascript = "…"` / `css = "…"` block the embedded-language
		// provider forwards to the JS/TS / CSS service instead.
		if (suppressForEmbedded(document, position)) {
			return null;
		}
		// The user closed the hints with Esc inside this call.
		if (isDismissed(document, position)) {
			return null;
		}

		const line = document.lineAt(position.line).text;

		// find the opening paren for the call
		const idx = findCallOpen(line, position.character);
		if (idx < 0) {
			return null;
		}

		// identifier immediately before '('
		const before = line.slice(0, idx).trimEnd();
		const m = before.match(/([A-Za-zÄÖÜäöüß_][A-Za-z0-9_-]*)\s*$/);
		if (!m) {
			return null;
		}
		const name = m[1].toLowerCase();

		const glossary: Glossary = await loadGlossary(this.extensionUri);
		const entry = glossary[name];

		// try to extract a param list from entry.detail like "name(p1, p2)"
		let params: string[] = [];
		if (entry && typeof entry.detail === 'string') {
			const p = entry.detail.match(/\(([^)]+)\)/);
			if (p) {
				params = p[1].split(',').map((s) => s.trim());
			}
		}
		if (params.length === 0) {
			params = /load|set|compute/i.test(name)
				? ['target', 'expression']
				: ['...args'];
		}

		const si = new vscode.SignatureInformation(
			`${name}(${params.join(', ')})`,
			entry ? entry.detail : '',
		);
		si.parameters = params.map((p) => new vscode.ParameterInformation(p));

		// active parameter = commas at depth 0 between '(' and the cursor
		const argText = line.slice(idx + 1, position.character);
		let d = 0;
		let paramIndex = 0;
		for (const ch of argText) {
			if (ch === '(') {
				d++;
			} else if (ch === ')') {
				d--;
			} else if (ch === ',' && d === 0) {
				paramIndex++;
			}
		}

		const sh = new vscode.SignatureHelp();
		sh.signatures = [si];
		sh.activeSignature = 0;
		sh.activeParameter = Math.min(paramIndex, params.length - 1);
		return sh;
	}
}

/**
 * Index of the unmatched `(` left of `character` in `line`, i.e. the opening
 * paren of the call the cursor is in; -1 when there is none.
 */
export function findCallOpen(line: string, character: number): number {
	let depth = 0;
	for (let idx = character - 1; idx >= 0; idx--) {
		const ch = line[idx];
		if (ch === ')') {
			depth++;
		} else if (ch === '(') {
			if (depth === 0) {
				return idx;
			}
			depth--;
		}
	}
	return -1;
}

/**
 * Whether `character` lies within the arguments of the call whose `(` is at
 * `open` – after the paren and not past its matching `)`. Nested calls count
 * as inside.
 */
export function callArgsContain(
	line: string,
	open: number,
	character: number,
): boolean {
	if (line[open] !== '(' || character <= open) {
		return false;
	}
	let depth = 0;
	for (let idx = open + 1; idx < character && idx < line.length; idx++) {
		const ch = line[idx];
		if (ch === '(') {
			depth++;
		} else if (ch === ')') {
			if (depth === 0) {
				return false;
			}
			depth--;
		}
	}
	return true;
}

/**
 * Internal command bound to Esc while parameter hints are visible: closes
 * them and keeps them closed while the cursor stays in the same call.
 */
export const DISMISS_SIGNATURE_COMMAND = 'gessq.dismissSignatureHelp';

/** The call whose hints the user dismissed (document, line, `(` column). */
let dismissed: { uri: string; line: number; open: number } | undefined;

/** Whether signature help is dismissed for the call at `position`. */
export function isDismissed(
	document: vscode.TextDocument,
	position: vscode.Position,
): boolean {
	if (
		!dismissed ||
		dismissed.uri !== document.uri.toString() ||
		dismissed.line !== position.line
	) {
		return false;
	}
	const line = document.lineAt(position.line).text;
	return callArgsContain(line, dismissed.open, position.character);
}

/**
 * Remember the call at `position` as dismissed; returns whether there is
 * one. Exposed for tests.
 */
export function dismissAt(
	document: vscode.TextDocument,
	position: vscode.Position,
): boolean {
	const line = document.lineAt(position.line).text;
	const open = findCallOpen(line, position.character);
	dismissed =
		open < 0
			? undefined
			: { uri: document.uri.toString(), line: position.line, open };
	return dismissed !== undefined;
}

/** Forget a dismissal. Exposed for tests. */
export function clearDismissal(): void {
	dismissed = undefined;
}

/**
 * Register {@link DISMISS_SIGNATURE_COMMAND} and the listeners that end a
 * dismissal once the cursor leaves the call. Call once from `activate`.
 */
export function registerSignatureDismiss(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(DISMISS_SIGNATURE_COMMAND, async () => {
			const editor = vscode.window.activeTextEditor;
			if (
				editor &&
				!suppressForEmbedded(editor.document, editor.selection.active)
			) {
				dismissAt(editor.document, editor.selection.active);
			}
			await vscode.commands.executeCommand('closeParameterHints');
		}),
		vscode.window.onDidChangeTextEditorSelection((e) => {
			if (
				dismissed &&
				e.textEditor.document.uri.toString() === dismissed.uri &&
				!isDismissed(e.textEditor.document, e.selections[0].active)
			) {
				dismissed = undefined;
			}
		}),
		vscode.workspace.onDidChangeTextDocument((e) => {
			// An edit before the paren moves it – the remembered column is stale.
			if (
				dismissed &&
				e.document.uri.toString() === dismissed.uri &&
				e.contentChanges.some(
					(c) =>
						c.range.start.line < dismissed!.line ||
						(c.range.start.line === dismissed!.line &&
							c.range.start.character <= dismissed!.open),
				)
			) {
				dismissed = undefined;
			}
		}),
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (dismissed && doc.uri.toString() === dismissed.uri) {
				dismissed = undefined;
			}
		}),
	);
}
