'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import {
	loadGlossary,
	lookupEntry,
	formatEntryMarkdown,
	type Glossary,
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
 * Hover for GESS Q.:
 * - a bare language keyword → the full glossary entry (heading, syntax,
 *   summary, handbook link);
 * - a name defined in the workspace → what it is (`NAME — question
 *   \`singleq\``), the definition location and a code preview, plus the
 *   command's short description and handbook link. On the definition line
 *   itself the locator and preview are dropped (the line is already visible).
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

		const glossary = await loadGlossary(this.extensionUri);
		const symbolPart = await this.symbolHover(
			document,
			position,
			word,
			glossary,
		);
		if (token.isCancellationRequested) {
			return null;
		}

		if (symbolPart) {
			md.appendMarkdown(symbolPart);
		} else {
			const lineText = document.lineAt(position.line).text;
			const entry =
				lookupEntry(
					glossary,
					disambiguateKeyword(word, lineText) ?? word,
				) ?? lookupEntry(glossary, word);
			if (entry) {
				md.appendMarkdown(formatEntryMarkdown(word, entry));
			}
		}

		return md.value.length > 0 ? new vscode.Hover(md) : null;
	}

	private async symbolHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		word: string,
		glossary: Glossary,
	): Promise<string | undefined> {
		const lower = word.toLowerCase();
		await this.index.ready;

		const here = document.uri.toString();
		const local = parseDocumentSymbols(document).filter(
			(s) => s.lower === lower,
		);

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

		// A short description of the underlying command plus its handbook link,
		// pulled from the glossary entry for the keyword (`d.detail`).
		const kw = lookupEntry(glossary, d.detail);
		const kwDoc = kw
			? (kw.summary ? kw.summary + '\n\n' : '') + kw.detail
			: '';

		const head =
			'**' + d.name + '** — ' + d.category + ' `' + d.detail + '`';

		// Standing anywhere on a line that defines this word: the definition is
		// right there, so skip the "defined at …:N" locator and the code
		// preview (they only repeat the visible line) – keep the command
		// description and link.
		if (local.some((s) => s.lineRange.contains(position))) {
			return kwDoc ? head + '\n\n' + kwDoc : undefined;
		}

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
			head +
			' · ' +
			where +
			(preview ? '\n\n```gessq\n' + preview + '\n```' : '') +
			(kwDoc ? '\n\n' + kwDoc : '')
		);
	}
}
