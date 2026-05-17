'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWordAtPosition } from '../commons/vscodeUtils';
import { debug, warn, error } from '../commons/logger';

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

function loadGlossary(
	contextPath?: string,
): Record<string, { short: string; detail: string }> {
	if (glossaryCache) return glossaryCache;

	const tried: string[] = [];
	const candidates: string[] = [];

	if (contextPath) {
		// when running in extension dev host, context.extensionPath points to workspace root
		candidates.push(
			path.join(contextPath, 'src', 'commons', 'manualGlossary.json'),
		);
		candidates.push(
			path.join(contextPath, 'commons', 'manualGlossary.json'),
		);
	}
	// try paths relative to compiled __dirname (out/components or out/src/components)
	candidates.push(
		path.join(__dirname, '..', 'src', 'commons', 'manualGlossary.json'),
	);
	candidates.push(
		path.join(__dirname, '..', 'commons', 'manualGlossary.json'),
	);
	candidates.push(
		path.join(
			__dirname,
			'..',
			'..',
			'src',
			'commons',
			'manualGlossary.json',
		),
	);

	for (const gpath of candidates) {
		tried.push(gpath);
		try {
			if (fs.existsSync(gpath)) {
				const txt = fs.readFileSync(gpath, 'utf8');
				glossaryCache = JSON.parse(txt) as Record<
					string,
					{ short: string; detail: string }
				>;
				debug('GessQHoverProvider: loaded glossary from ' + gpath);
				return glossaryCache;
			}
		} catch (e) {
			error(
				'GessQHoverProvider: error reading glossary ' +
					gpath +
					' ' +
					String(e),
			);
		}
	}

	warn(
		'GessQHoverProvider: manualGlossary.json not found. Tried: ' +
			tried.join(', '),
	);
	glossaryCache = Object.create(null) as Record<
		string,
		{ short: string; detail: string }
	>;
	return glossaryCache;
}

export class GessQHoverProvider implements vscode.HoverProvider {
	constructor(private extensionRoot?: string) {}

	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.Hover> {
		debug(
			'GessQHoverProvider.provideHover called for ' +
				document.uri.toString() +
				' ' +
				position.line +
				':' +
				position.character,
		);
		const w = getWordAtPosition(document, position);
		if (!w[0]) {
			debug(
				'GessQHoverProvider: no word at position ' +
					position.line +
					':' +
					position.character,
			);
			return null;
		}
		const wordRaw = w[1];

		const glossary = loadGlossary(this.extensionRoot);
		const directKey = wordRaw.toLowerCase();
		const normKey = normalizeKey(wordRaw.replace(/[()@:,]/g, ' '));
		const entry = glossary[directKey] || glossary[normKey];
		if (!entry) return null;

		const md = new vscode.MarkdownString();
		md.appendMarkdown('**' + wordRaw + '** — ' + entry.short + '\n\n');
		md.appendMarkdown(entry.detail);
		md.isTrusted = false;
		return new vscode.Hover(md);
	}
}
