'use strict';

import * as vscode from 'vscode';
import { isNotInCommentAt } from './scope';

export interface IncludeDirective {
	/** `include` or `includeifexists`. */
	keyword: string;
	/** `true` for `#includeifexists`. */
	optional: boolean;
	/** The path as written between the quotes. */
	target: string;
	/** Range of the path text (without the surrounding quotes). */
	targetRange: vscode.Range;
	/** `target` resolved against the including document's folder. */
	resolved: vscode.Uri;
}

const RE = /#(include|includeifexists)\s*(["'])([^"']+)\2/gi;

/**
 * Parse all `#include` / `#includeifexists` directives in `document`
 * (skipping matches inside comments).
 */
export function parseIncludes(
	document: vscode.TextDocument,
): IncludeDirective[] {
	const base = vscode.Uri.joinPath(document.uri, '..');
	const out: IncludeDirective[] = [];

	for (let line = 0; line < document.lineCount; line++) {
		const text = document.lineAt(line).text;
		if (!text.includes('#include')) {
			continue;
		}
		RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = RE.exec(text))) {
			if (!isNotInCommentAt(document, line, m.index)) {
				continue;
			}
			const target = m[3];
			const pathStart = m.index + m[0].length - 1 - target.length;
			out.push({
				keyword: m[1].toLowerCase(),
				optional: m[1].toLowerCase() === 'includeifexists',
				target,
				targetRange: new vscode.Range(
					line,
					pathStart,
					line,
					pathStart + target.length,
				),
				resolved: vscode.Uri.joinPath(base, target),
			});
		}
	}

	return out;
}
