'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWordAtPosition } from '../commons/vscodeUtils';

let glossaryCache: Record<string, any> | null = null;

/**
 * Load and cache the manual glossary JSON file.
 * If the glossary was already loaded, the cached object is returned.
 * If the file cannot be read or parsed this returns an empty object.
 * @param contextPath Optional base path to resolve the `commons/manualGlossary.json` from.
 * @returns Parsed glossary object (possibly empty) cached for subsequent calls.
 */
function loadGlossary(contextPath?: string) {
	if (glossaryCache) return glossaryCache;
	try {
		const base = contextPath || path.join(__dirname, '..');
		const gpath = path.join(base, 'commons', 'manualGlossary.json');
		const txt = fs.readFileSync(gpath, 'utf8');
		glossaryCache = JSON.parse(txt);
		return glossaryCache;
	} catch (e) {
		glossaryCache = {};
		return glossaryCache;
	}
}

/**
 * Signature Help provider for the gessQ language.
 *
 * It uses the `manualGlossary.json` file (when available) to produce
 * parameter lists for known macros / commands and falls back to heuristics
 * when no explicit signature is present.
 */
export class GessQSignatureProvider implements vscode.SignatureHelpProvider {
	/**
	 * Create a new provider.
	 * @param extensionRoot optional extension root path used to resolve the glossary file.
	 */
	constructor(private extensionRoot?: string) {}

	/**
	 * Provide a `SignatureHelp` object at the given position.
	 * This implementation searches the current line for the nearest '(' before
	 * the cursor, extracts the identifier immediately before it and looks up
	 * a signature description in the glossary.
	 *
	 * @param document The active text document.
	 * @param position Cursor position where signature help was requested.
	 * @param token Cancellation token.
	 * @param context Additional context provided by VS Code.
	 * @returns A `SignatureHelp` (or `null` when not applicable).
	 */
	public provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.SignatureHelpContext,
	): vscode.ProviderResult<vscode.SignatureHelp> {
		// find the opening paren for the call
		const line = document.lineAt(position.line).text;
		let idx = position.character - 1;
		// move left until '(' or start
		while (idx >= 0 && line[idx] !== '(') {
			idx--;
		}
		if (idx < 0) return null;

		// word before '('
		const before = line.slice(0, idx).trimEnd();
		const m = before.match(/([A-Za-zÄÖÜäöüß_][A-Za-z0-9_\-]*)\s*$/);
		if (!m) return null;
		const name = m[1].toLowerCase();

		const glossary = (loadGlossary(this.extensionRoot) || {}) as Record<
			string,
			any
		>;
		const entry = glossary[name];

		// heuristic: try to extract param list from entry.detail like "name(param1, param2)"
		let params: string[] = [];
		if (entry && typeof entry.detail === 'string') {
			const p = entry.detail.match(/\(([^)]+)\)/);
			if (p) {
				params = p[1].split(',').map((s: string) => s.trim());
			}
		}

		// fallback: no params -> single placeholder
		if (params.length === 0) {
			// try to guess from common constructs
			if (/load|set|compute/i.test(name)) {
				params = ['target', 'expression'];
			} else {
				params = ['...args'];
			}
		}

		const sigLabel = `${name}(${params.join(', ')})`;
		const si = new vscode.SignatureInformation(
			sigLabel,
			entry ? entry.detail : '',
		);
		si.parameters = params.map((p) => new vscode.ParameterInformation(p));

		// determine active parameter by counting commas between '(' and current position
		const argText = line.slice(idx + 1, position.character);
		let depth = 0;
		let paramIndex = 0;
		for (let i = 0; i < argText.length; i++) {
			const ch = argText[i];
			if (ch === '(') depth++;
			else if (ch === ')') depth--;
			else if (ch === ',' && depth === 0) paramIndex++;
		}

		const sh = new vscode.SignatureHelp();
		sh.signatures = [si];
		sh.activeSignature = 0;
		sh.activeParameter = Math.min(paramIndex, params.length - 1);
		return sh;
	}
}
