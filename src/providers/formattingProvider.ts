'use strict';

import * as vscode from 'vscode';
import { getCachedScope, ScopeEnum } from '../core/scope';

/**
 * Conservative formatter: re-indents each line to its `{`/`(` nesting depth
 * (brackets inside comments and strings are ignored). Lines that are wholly
 * inside a block comment or a multi-line string are left untouched, and only
 * leading whitespace is ever changed.
 *
 * This is deliberately simple – it will flatten free-form indentation such as
 * hand-aligned label lists – so it only runs when explicitly invoked
 * ("Format Document").
 */
export class GessQFormattingProvider
	implements
		vscode.DocumentFormattingEditProvider,
		vscode.DocumentRangeFormattingEditProvider
{
	public provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
	): vscode.TextEdit[] {
		return this.format(document, options, 0, document.lineCount - 1);
	}

	public provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
	): vscode.TextEdit[] {
		return this.format(document, options, range.start.line, range.end.line);
	}

	private format(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		fromLine: number,
		toLine: number,
	): vscode.TextEdit[] {
		const scope = getCachedScope(document);
		const unit = options.insertSpaces
			? ' '.repeat(Math.max(1, options.tabSize))
			: '\t';

		const edits: vscode.TextEdit[] = [];
		let depth = 0;

		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			const trimmed = text.trimStart();
			const firstCh = text.length - trimmed.length;

			// A line that is only a continuation of a comment/string keeps its
			// current indentation.
			const skip =
				trimmed.length > 0 &&
				scope.getScope(line, firstCh) !== ScopeEnum.normal;

			const closesFirst = /^[)}]/.test(trimmed);
			const lineDepth = Math.max(0, closesFirst ? depth - 1 : depth);

			if (
				!skip &&
				trimmed.length > 0 &&
				line >= fromLine &&
				line <= toLine
			) {
				const want = unit.repeat(lineDepth);
				if (text.slice(0, firstCh) !== want) {
					edits.push(
						vscode.TextEdit.replace(
							new vscode.Range(line, 0, line, firstCh),
							want,
						),
					);
				}
			}

			// update depth from the brackets actually on this line
			for (let ch = 0; ch < text.length; ch++) {
				if (scope.getScope(line, ch) !== ScopeEnum.normal) {
					continue;
				}
				const c = text[ch];
				if (c === '{' || c === '(') {
					depth++;
				} else if (c === '}' || c === ')') {
					depth = Math.max(0, depth - 1);
				}
			}
		}

		return edits;
	}
}
