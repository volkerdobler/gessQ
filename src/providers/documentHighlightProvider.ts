'use strict';

import * as vscode from 'vscode';
import { getWordAtPosition } from '../infra/vscodeUtils';
import { isNotInCommentAt } from '../core/scope';
import { parseDocumentSymbols } from '../core/symbolIndex';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Highlights every whole-word, non-comment occurrence of the identifier under
 * the cursor in the current document. The occurrence that is a definition is
 * marked as a write access.
 */
export class GessQDocumentHighlightProvider
	implements vscode.DocumentHighlightProvider
{
	public provideDocumentHighlights(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): vscode.DocumentHighlight[] {
		const [found, word] = getWordAtPosition(document, position);
		if (!found || token.isCancellationRequested) {
			return [];
		}

		const defLines = new Set(
			parseDocumentSymbols(document)
				.filter((s) => s.lower === word.toLowerCase())
				.map((s) => s.nameRange.start.line),
		);

		const re = new RegExp('\\b' + escapeRe(word) + '\\b', 'gi');
		const highlights: vscode.DocumentHighlight[] = [];

		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				if (!isNotInCommentAt(document, line, m.index)) {
					continue;
				}
				highlights.push(
					new vscode.DocumentHighlight(
						new vscode.Range(
							line,
							m.index,
							line,
							m.index + m[0].length,
						),
						defLines.has(line)
							? vscode.DocumentHighlightKind.Write
							: vscode.DocumentHighlightKind.Read,
					),
				);
			}
		}

		return highlights;
	}
}
