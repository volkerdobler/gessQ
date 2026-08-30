'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import {
	loadGlossary,
	lookupEntry,
	formatEntryMarkdown,
	type Glossary,
} from '../data/glossary';
import {
	SymbolIndex,
	parseDocumentSymbols,
	type IndexedSymbol,
} from '../core/symbolIndex';
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

/** Keywords that open a new top-level definition (and so end the previous one). */
const DEF_BOUNDARY =
	/^\s*(?:singleq|multiq|singlegridq|multigridq|openq|textq|numq|gnumq|passwdq|uploadq|group|sliderq|compute|array|vararray|textelement|textarray|intrandom|opennumformat|quotavar|block|screen|page|chapter|endchapter|filter|endfilter|#\w+)\b/i;

/**
 * Attribute statements dropped from a definition excerpt (long / noisy).
 * Covers every `*ActionBlock` plus `javascript` / `jsHandler` / `css`, whether
 * written as `attr = "…";` or as a brace block `attr = { … };`.
 */
const EXCERPT_OMIT = /^\s*(?:[a-z]*actionblock|javascript|jshandler|css)\s*=/i;

/** How many source lines to scan before giving up (guards runaway braces). */
const EXCERPT_SCAN_LIMIT = 600;

/**
 * Build a readable excerpt of a definition for a hover: the definition line
 * plus its attribute statements, up to the next top-level definition, a blank
 * line or `maxLines`. `actionblock` / `javascript` / `css` attributes are left
 * out whole – including brace-delimited action blocks that span dozens of
 * lines. Strings (`"…"` / `'…'`) and comments (`//`, `/* … *\/`) are tracked so
 * their content is never mistaken for a boundary or a brace.
 *
 * @param lines full text of the file, split into lines
 * @param start 0-based index of the definition line
 */
export function definitionExcerpt(
	lines: string[],
	start: number,
	maxLines = 40,
): string {
	const out: string[] = [];
	let inString: '"' | "'" | '' = '';
	let inBlockComment = false;
	let omitting = false;
	let omitBrace = 0;
	let truncated = false;

	const end = Math.min(lines.length, start + EXCERPT_SCAN_LIMIT);
	for (let i = start; i < end; i++) {
		const raw = lines[i];
		const clearAtLineStart = inString === '' && !inBlockComment;

		// Boundaries are only meaningful on a "clear" line outside an omitted
		// attribute – a blank line or a stray `singleq` inside an action block
		// or a multi-line string must not end the excerpt.
		if (!omitting && clearAtLineStart && i > start) {
			if (raw.trim() === '' || DEF_BOUNDARY.test(raw)) {
				break;
			}
			if (EXCERPT_OMIT.test(raw)) {
				omitting = true;
				omitBrace = 0;
			}
		}

		// Scan the line, updating string / comment state and – while omitting –
		// the brace depth of the attribute being skipped.
		let lineComment = false;
		let lastSignificant = '';
		for (let c = 0; c < raw.length; c++) {
			const ch = raw[c];
			const nx = raw[c + 1];
			if (inBlockComment) {
				if (ch === '*' && nx === '/') {
					inBlockComment = false;
					c++;
				}
				continue;
			}
			if (inString) {
				if (ch === '\\') {
					c++;
				} else if (ch === inString) {
					inString = '';
				}
				lastSignificant = ch;
				continue;
			}
			if (lineComment) {
				break;
			}
			if (ch === '/' && nx === '/') {
				lineComment = true;
				c++;
				continue;
			}
			if (ch === '/' && nx === '*') {
				inBlockComment = true;
				c++;
				continue;
			}
			if (ch === '"' || ch === "'") {
				inString = ch as '"' | "'";
				lastSignificant = ch;
				continue;
			}
			if (ch === ' ' || ch === '\t') {
				continue;
			}
			if (omitting) {
				if (ch === '{') {
					omitBrace++;
				} else if (ch === '}') {
					omitBrace--;
				}
			}
			lastSignificant = ch;
		}

		if (!omitting) {
			if (out.length >= maxLines) {
				truncated = true;
				break;
			}
			out.push(raw.replace(/\s+$/, ''));
		} else if (
			inString === '' &&
			!inBlockComment &&
			omitBrace <= 0 &&
			lastSignificant === ';'
		) {
			// The omitted attribute's terminating `;` – `attr = "…";` or the
			// closing `};` of a brace block.
			omitting = false;
		}
	}

	while (out.length && out[out.length - 1].trim() === '') {
		out.pop();
	}
	return out.join('\n') + (truncated ? '\n…' : '');
}

/**
 * Hover for GESS Q.:
 * - the name in its own definition → nothing (hover the command keyword for
 *   its documentation instead);
 * - a language keyword → the full glossary entry (heading, syntax, summary,
 *   handbook link);
 * - a reference to a workspace symbol → what it is (`NAME — question
 *   \`singleq\``), where it is defined, an excerpt of the definition (without
 *   actionblock / javascript / css attributes), and the command's short
 *   description + handbook link.
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

		await this.index.ready;
		if (token.isCancellationRequested) {
			return null;
		}

		const lower = word.toLowerCase();
		const localDefs = parseDocumentSymbols(document).filter(
			(s) => s.lower === lower,
		);

		// The name in its own definition: show nothing.
		if (localDefs.some((s) => s.nameRange.contains(position))) {
			return null;
		}

		const glossary = await loadGlossary(this.extensionUri);
		const md = new vscode.MarkdownString();
		md.isTrusted = false;

		const onDefLine = localDefs.some((s) => s.lineRange.contains(position));
		const here = document.uri.toString();
		const defs = onDefLine
			? []
			: [
					...localDefs,
					...this.index
						.definitionsOf(word)
						.filter((s) => s.uri.toString() !== here),
				];

		if (defs.length > 0) {
			md.appendMarkdown(await this.symbolExcerpt(defs[0], glossary));
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

		if (token.isCancellationRequested) {
			return null;
		}
		return md.value.length > 0 ? new vscode.Hover(md) : null;
	}

	/** Heading + definition excerpt + command description for a symbol hover. */
	private async symbolExcerpt(
		d: IndexedSymbol,
		glossary: Glossary,
	): Promise<string> {
		const where =
			vscode.workspace.asRelativePath(d.uri) +
			':' +
			(d.nameRange.start.line + 1);
		const head =
			'**' + d.name + '** — ' + d.category + ' `' + d.detail + '` · ' + where;

		let excerpt = '';
		try {
			const doc = await vscode.workspace.openTextDocument(d.uri);
			excerpt = definitionExcerpt(
				doc.getText().split(/\r?\n/),
				d.nameRange.start.line,
			);
		} catch {
			/* ignore */
		}

		const kw = lookupEntry(glossary, d.detail);
		const kwDoc = kw
			? (kw.summary ? kw.summary + '\n\n' : '') + kw.detail
			: '';

		return (
			head +
			(excerpt ? '\n\n```gessq\n' + excerpt + '\n```' : '') +
			(kwDoc ? '\n\n' + kwDoc : '')
		);
	}
}
