'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import { debug } from '../infra/logger';
import { loadGlossary, lookupEntry } from '../data/glossary';

export class GessQHoverProvider implements vscode.HoverProvider {
	constructor(private readonly extensionUri: vscode.Uri) {}

	public async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): Promise<vscode.Hover | null> {
		const w = getWordAtPosition(document, position);
		if (!w[0]) {
			return null;
		}
		const wordRaw = w[1];

		const glossary = await loadGlossary(this.extensionUri);
		const entry = lookupEntry(glossary, wordRaw);
		if (!entry) {
			debug(
				'GessQHoverProvider: no glossary entry for "' + wordRaw + '"',
			);
			return null;
		}

		const md = new vscode.MarkdownString();
		md.appendMarkdown('**' + wordRaw + '** — ' + entry.short + '\n\n');
		md.appendMarkdown(entry.detail);
		md.isTrusted = false;
		return new vscode.Hover(md);
	}
}
