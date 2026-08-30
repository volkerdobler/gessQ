'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { isNotInCommentAt } from './scope';

const escapeRe = parser.escapeRe;

/**
 * Regex factories that identify a *line* as referencing a symbol. A line
 * counts as a reference when at least one of these matches outside a comment.
 */
function referencePatterns(word: string): RegExp[] {
	const w = escapeRe(word);
	return [
		parser.questionDefRe(word),
		parser.definitionDefRe(word),
		parser.arrayDefRe(word),
		parser.quotavarDefRe(word),
		parser.blockDefRe(word),
		parser.blockRe(word),
		parser.checkRe(word),
		parser.assertRe(word),
		parser.computeRe(word),
		parser.computeDefRe(word),
		parser.textArrayDefRe(word),
		parser.textElementDefRe(word),
		parser.intRandomDefRe(word),
		parser.databaseConnectionDefRe(word),
		parser.actionBlockDefRe(word),
		parser.macroDefRe(word),
		// macro instantiation: `&name;` and `#domacro name`
		new RegExp('&' + w + '\\b', 'i'),
		new RegExp('#domacro\\s+' + w + '\\b', 'i'),
		// opennumformat used in a NumQ/GNumQ/SliderQ label: `… format ONF`
		new RegExp('\\bformat\\b\\s+' + w + '\\b', 'i'),
	];
}

/** Precise ranges of every whole-word, non-comment occurrence of `word`. */
function wordRangesInLine(
	document: vscode.TextDocument,
	line: number,
	word: string,
): vscode.Range[] {
	const re = new RegExp('\\b' + escapeRe(word) + '\\b', 'gi');
	const text = document.lineAt(line).text;
	const ranges: vscode.Range[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		if (isNotInCommentAt(document, line, m.index)) {
			ranges.push(
				new vscode.Range(line, m.index, line, m.index + m[0].length),
			);
		}
	}
	return ranges;
}

/**
 * Collect precise reference Locations for `word` across `files`.
 * Honours `token` for cancellation.
 */
export async function findReferences(
	files: vscode.Uri[],
	word: string,
	token?: vscode.CancellationToken,
): Promise<vscode.Location[]> {
	const patterns = referencePatterns(word);
	const results: vscode.Location[] = [];

	await Promise.all(
		files.map(async (uri) => {
			if (token?.isCancellationRequested) {
				return;
			}
			let doc: vscode.TextDocument;
			try {
				doc = await vscode.workspace.openTextDocument(uri);
			} catch {
				return;
			}
			for (let i = 0; i < doc.lineCount; i++) {
				if (token?.isCancellationRequested) {
					return;
				}
				const text = doc.lineAt(i).text;
				if (text.length === 0) {
					continue;
				}
				const isRefLine = patterns.some((re) => {
					const at = text.search(re);
					return at > -1 && isNotInCommentAt(doc, i, at);
				});
				if (!isRefLine) {
					continue;
				}
				for (const range of wordRangesInLine(doc, i, word)) {
					results.push(new vscode.Location(doc.uri, range));
				}
			}
		}),
	);

	return results;
}
