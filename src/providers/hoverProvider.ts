'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import {
	loadGlossary,
	lookupEntry,
	formatEntryMarkdown,
} from '../data/glossary';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';
import { hoverEnabled } from '../infra/config';

/**
 * Some keywords mean different things in different positions and need a
 * context-specific glossary key. Returns that key, or `undefined` to fall back
 * to the plain lowercase lookup.
 *
 * - `single = yes|no;` on its own is the Group attribute (single choice for a
 *   group); as a bare token after a label it is the exclusive-answer label
 *   attribute. The handbook only indexes the latter.
 */
export function disambiguateKeyword(
	word: string,
	lineText: string,
): string | undefined {
	if (word.toLowerCase() === 'single' && /^\s*single\s*=/i.test(lineText)) {
		return 'single-group';
	}
	return undefined;
}

/**
 * Hover for GESS Q.: a glossary description for language keywords, and – for
 * names defined in the workspace – the definition location plus a short code
 * preview.
 */
export class GessQHoverProvider implements vscode.HoverProvider {
	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly index: SymbolIndex,
	) {}

	public async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Hover | null> {
		if (!hoverEnabled()) {
			return null;
		}

		const [found, word] = getWordAtPosition(document, position);
		if (!found) {
			return null;
		}

		const md = new vscode.MarkdownString();
		md.isTrusted = false;

		const symbolPart = await this.symbolHover(document, position, word);
		if (token.isCancellationRequested) {
			return null;
		}
		if (symbolPart) {
			md.appendMarkdown(symbolPart);
		}

		const glossary = await loadGlossary(this.extensionUri);
		const lineText = document.lineAt(position.line).text;
		const entry =
			lookupEntry(glossary, disambiguateKeyword(word, lineText) ?? word) ??
			lookupEntry(glossary, word);
		if (entry) {
			if (symbolPart) {
				md.appendMarkdown('\n\n---\n\n');
			}
			md.appendMarkdown(formatEntryMarkdown(word, entry));
		}

		return md.value.length > 0 ? new vscode.Hover(md) : null;
	}

	private async symbolHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		word: string,
	): Promise<string | undefined> {
		const lower = word.toLowerCase();
		await this.index.ready;

		const here = document.uri.toString();
		const local = parseDocumentSymbols(document).filter(
			(s) => s.lower === lower,
		);

		// Standing on the name in its own definition – the line itself is
		// already visible, so a "defined here" hover adds nothing.
		if (local.some((s) => s.nameRange.contains(position))) {
			return undefined;
		}

		const defs = [
			...local,
			...this.index
				.definitionsOf(word)
				.filter((s) => s.uri.toString() !== here),
		];
		if (defs.length === 0) {
			return undefined;
		}

		const d = defs[0];
		const where =
			vscode.workspace.asRelativePath(d.uri) +
			':' +
			(d.nameRange.start.line + 1);
		let preview = '';
		try {
			const doc = await vscode.workspace.openTextDocument(d.uri);
			preview = doc.lineAt(d.nameRange.start.line).text.trim();
		} catch {
			/* ignore */
		}

		return (
			'**' +
			d.name +
			'** — ' +
			d.category +
			' `' +
			d.detail +
			'` · ' +
			where +
			(preview ? '\n\n```gessq\n' + preview + '\n```' : '')
		);
	}
}
