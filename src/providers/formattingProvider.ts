'use strict';

import * as vscode from 'vscode';
import { getCachedScope, Scope, ScopeEnum } from '../core/scope';
import { LIST_START } from './completionProvider';

/**
 * True when `text` (at `line`) has a `;` in normal scope (not a string) at
 * or after `fromIndex` – the statement-terminating `;` of a `labels=` /
 * `gridlabels=` / `griditems=` list, same check as
 * `completionProvider.ts`'s `isInLabelList`.
 */
function hasTopLevelSemicolonAfter(
	text: string,
	line: number,
	scope: Scope,
	fromIndex: number,
): boolean {
	for (let c = fromIndex; c < text.length; c++) {
		if (text[c] === ';' && scope.getScope(line, c) === ScopeEnum.normal) {
			return true;
		}
	}
	return false;
}

/**
 * Conservative formatter: re-indents each line to its `{`/`(` nesting depth
 * (brackets inside comments and strings are ignored). Lines that are wholly
 * inside a block comment or a multi-line string are left untouched, and only
 * leading whitespace is ever changed.
 *
 * One exception: the body of a `labels=` / `gridlabels=` / `griditems=` list
 * (label codes, `group( … )`, …) is left exactly as written – only trailing
 * whitespace is trimmed there – because it is routinely hand-aligned in a
 * way that plain bracket-depth indentation would flatten (`group(` opens a
 * paren like any other, but its content is a label list, not a nested code
 * block). The `labels=` line itself still gets normal indentation; only the
 * lines between it and its terminating `;` are exempt.
 *
 * Otherwise this is deliberately simple – it only runs when explicitly
 * invoked ("Format Document").
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
		// True while inside the body of a labels=/gridlabels=/griditems= list
		// (set for the line *after* the opener, cleared on the line that
		// carries the closing `;`) – see the class doc comment.
		let inLabelList = false;

		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			const trimmed = text.trimStart();
			const firstCh = text.length - trimmed.length;
			const protect = inLabelList;

			// A line that is only a continuation of a comment/string keeps its
			// current indentation.
			const skip =
				trimmed.length > 0 &&
				scope.getScope(line, firstCh) !== ScopeEnum.normal;

			const closesFirst = /^[)}]/.test(trimmed);
			const lineDepth = Math.max(0, closesFirst ? depth - 1 : depth);

			if (
				!protect &&
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

			// Label-list content isn't reindented (see above), but trailing
			// whitespace is still safe to trim – unless it's itself part of an
			// unterminated multi-line string/comment.
			if (protect && line >= fromLine && line <= toLine) {
				const withoutTrailing = text.replace(/[ \t]+$/, '');
				if (withoutTrailing.length < text.length) {
					let safeToTrim = true;
					for (let c = withoutTrailing.length; c < text.length; c++) {
						if (scope.getScope(line, c) !== ScopeEnum.normal) {
							safeToTrim = false;
							break;
						}
					}
					if (safeToTrim) {
						edits.push(
							vscode.TextEdit.replace(
								new vscode.Range(
									line,
									withoutTrailing.length,
									line,
									text.length,
								),
								'',
							),
						);
					}
				}
			}

			// update depth from the brackets actually on this line – tracked
			// even while `protect` is set, so indentation after the list still
			// lines up correctly.
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

			// Update label-list membership for the *next* line.
			if (!inLabelList) {
				const m = LIST_START.exec(text);
				if (m && scope.getScope(line, m.index) === ScopeEnum.normal) {
					inLabelList = !hasTopLevelSemicolonAfter(
						text,
						line,
						scope,
						m.index + m[0].length,
					);
				}
			} else if (hasTopLevelSemicolonAfter(text, line, scope, 0)) {
				inLabelList = false;
			}
		}

		return edits;
	}
}
