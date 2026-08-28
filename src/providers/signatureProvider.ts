'use strict';

import * as vscode from 'vscode';
import { loadGlossary, type Glossary } from '../data/glossary';

/**
 * Signature Help provider for the gessQ language.
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
		const line = document.lineAt(position.line).text;

		// find the opening paren for the call
		let idx = position.character - 1;
		let depth = 0;
		while (idx >= 0) {
			const ch = line[idx];
			if (ch === ')') {
				depth++;
			} else if (ch === '(') {
				if (depth === 0) {
					break;
				}
				depth--;
			}
			idx--;
		}
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
