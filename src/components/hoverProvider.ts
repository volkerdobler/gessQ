'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWordAtPosition } from '../commons/vscodeUtils';

let glossaryCache: Record<string, { short: string; detail: string }> | null =
	null;

function normalizeKey(s: string) {
	return s
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

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

export class GessQHoverProvider implements vscode.HoverProvider {
	constructor(private extensionRoot?: string) {}

	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.Hover> {
		const w = getWordAtPosition(document, position);
		if (!w[0]) return null;
		const wordRaw = w[1];

		const glossary = loadGlossary(this.extensionRoot);
		const directKey = wordRaw.toLowerCase();
		const normKey = normalizeKey(wordRaw.replace(/[()@:,]/g, ' '));
		const entry = glossary[directKey] || glossary[normKey];
		if (!entry) return null;

		const md = new vscode.MarkdownString();
		md.appendMarkdown('**' + word + '** — ' + entry.short + '\n\n');
		md.appendMarkdown(entry.detail);
		md.isTrusted = false;
		return new vscode.Hover(md);
	}
}
