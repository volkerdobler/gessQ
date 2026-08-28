'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import { loadGlossary, lookupEntry } from '../data/glossary';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';

/**
 * Hover for gessQ: a glossary description for language keywords, and – for
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
		const [found, word] = getWordAtPosition(document, position);
		if (!found) {
			return null;
		}

		const md = new vscode.MarkdownString();
		md.isTrusted = false;

		const symbolPart = await this.symbolHover(document, word);
		if (token.isCancellationRequested) {
			return null;
		}
		if (symbolPart) {
			md.appendMarkdown(symbolPart);
		}

		const entry = lookupEntry(await loadGlossary(this.extensionUri), word);
		if (entry) {
			if (symbolPart) {
				md.appendMarkdown('\n\n---\n\n');
			}
			md.appendMarkdown('**' + word + '** — ' + entry.short + '\n\n');
			md.appendMarkdown(entry.detail);
		}

		return md.value.length > 0 ? new vscode.Hover(md) : null;
	}

	private async symbolHover(
		document: vscode.TextDocument,
		word: string,
	): Promise<string | undefined> {
		const lower = word.toLowerCase();
		await this.index.ready;

		const here = document.uri.toString();
		const defs = [
			...parseDocumentSymbols(document).filter((s) => s.lower === lower),
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
