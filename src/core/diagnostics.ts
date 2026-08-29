'use strict';

import * as vscode from 'vscode';
import { getCachedScope, ScopeEnum, isNotInCommentAt } from './scope';
import { parseDocumentSymbols } from './symbolIndex';
import { parseIncludes } from './includes';

const SRC = 'GESS Q.';

function diag(
	range: vscode.Range,
	message: string,
	severity = vscode.DiagnosticSeverity.Warning,
): vscode.Diagnostic {
	const d = new vscode.Diagnostic(range, message, severity);
	d.source = SRC;
	return d;
}

const charRange = (line: number, ch: number) =>
	new vscode.Range(line, ch, line, ch + 1);

/** Unbalanced `{}` / `()` outside comments and strings. */
function checkBrackets(document: vscode.TextDocument): vscode.Diagnostic[] {
	const scope = getCachedScope(document);
	const out: vscode.Diagnostic[] = [];
	const stacks: Record<string, { line: number; ch: number }[]> = {
		'{': [],
		'(': [],
	};
	const close: Record<string, string> = { '}': '{', ')': '(' };

	for (let line = 0; line < document.lineCount; line++) {
		const text = document.lineAt(line).text;
		for (let ch = 0; ch < text.length; ch++) {
			if (scope.getScope(line, ch) !== ScopeEnum.normal) {
				continue;
			}
			const c = text[ch];
			if (c === '{' || c === '(') {
				stacks[c].push({ line, ch });
			} else if (c === '}' || c === ')') {
				const open = close[c];
				if (stacks[open].length === 0) {
					out.push(
						diag(
							charRange(line, ch),
							`Unmatched "${c}"`,
							vscode.DiagnosticSeverity.Error,
						),
					);
				} else {
					stacks[open].pop();
				}
			}
		}
	}

	for (const open of ['{', '('] as const) {
		for (const pos of stacks[open]) {
			out.push(
				diag(
					charRange(pos.line, pos.ch),
					`Unclosed "${open}"`,
					vscode.DiagnosticSeverity.Error,
				),
			);
		}
	}
	return out;
}

interface Directive {
	open: RegExp;
	close: RegExp;
	openLabel: string;
	closeLabel: string;
}

const DIRECTIVES: Directive[] = [
	{
		open: /(?<!\w)#macro\b/i,
		close: /(?<!\w)#(endmacro|macroend)\b/i,
		openLabel: '#macro',
		closeLabel: '#endmacro',
	},
	{
		open: /(?<!\w)#ifn?def\b/i,
		close: /(?<!\w)#endif\b/i,
		openLabel: '#ifdef',
		closeLabel: '#endif',
	},
];

/** `#macro`/`#endmacro` and `#ifdef`/`#endif` that are not balanced. */
function checkDirectiveNesting(
	document: vscode.TextDocument,
): vscode.Diagnostic[] {
	const out: vscode.Diagnostic[] = [];

	for (const d of DIRECTIVES) {
		const openStack: vscode.Range[] = [];
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			const openAt = text.search(d.open);
			if (openAt > -1 && isNotInCommentAt(document, line, openAt)) {
				openStack.push(charRange(line, openAt));
			}
			const closeAt = text.search(d.close);
			if (closeAt > -1 && isNotInCommentAt(document, line, closeAt)) {
				if (openStack.length === 0) {
					out.push(
						diag(
							charRange(line, closeAt),
							`${d.closeLabel} without a matching ${d.openLabel}`,
							vscode.DiagnosticSeverity.Error,
						),
					);
				} else {
					openStack.pop();
				}
			}
		}
		for (const range of openStack) {
			out.push(
				diag(
					range,
					`${d.openLabel} without a matching ${d.closeLabel}`,
					vscode.DiagnosticSeverity.Error,
				),
			);
		}
	}
	return out;
}

/** The same name defined twice in the same file. */
function checkDuplicates(document: vscode.TextDocument): vscode.Diagnostic[] {
	const seen = new Map<string, number>();
	const out: vscode.Diagnostic[] = [];
	for (const s of parseDocumentSymbols(document)) {
		if (s.category === 'action') {
			continue; // assignments are expected to repeat
		}
		const key = s.category + '|' + s.lower;
		const count = (seen.get(key) ?? 0) + 1;
		seen.set(key, count);
		if (count > 1) {
			out.push(
				diag(
					s.nameRange,
					`Duplicate ${s.category} "${s.name}" (already defined above)`,
				),
			);
		}
	}
	return out;
}

/**
 * `rendering = html|thymeleaf;` must be global: only once, and before the
 * first question definition (see the rendering docs). Only flagged within a
 * single file – across `#include`s the check cannot see the whole script.
 */
function checkRendering(document: vscode.TextDocument): vscode.Diagnostic[] {
	const out: vscode.Diagnostic[] = [];
	const re = /\brendering\s*=/i;

	const firstQuestionLine = parseDocumentSymbols(document)
		.filter((s) => s.category === 'question')
		.reduce(
			(min, s) => Math.min(min, s.nameRange.start.line),
			Number.POSITIVE_INFINITY,
		);

	let seen = 0;
	for (let line = 0; line < document.lineCount; line++) {
		const at = document.lineAt(line).text.search(re);
		if (at < 0 || !isNotInCommentAt(document, line, at)) {
			continue;
		}
		seen++;
		const range = new vscode.Range(line, at, line, at + 'rendering'.length);
		if (seen > 1) {
			out.push(
				diag(
					range,
					'"rendering" should be set only once (it is global).',
				),
			);
		}
		if (line > firstQuestionLine) {
			out.push(
				diag(
					range,
					'"rendering" must be set before the first question definition.',
				),
			);
		}
	}
	return out;
}

/**
 * Synchronous lint checks (no file-system access).
 */
export function lintDocument(
	document: vscode.TextDocument,
): vscode.Diagnostic[] {
	return [
		...checkBrackets(document),
		...checkDirectiveNesting(document),
		...checkDuplicates(document),
		...checkRendering(document),
	];
}

/**
 * `#include "…"` targets that do not exist (`#includeifexists` is ignored).
 */
export async function lintIncludes(
	document: vscode.TextDocument,
): Promise<vscode.Diagnostic[]> {
	const out: vscode.Diagnostic[] = [];
	await Promise.all(
		parseIncludes(document).map(async (inc) => {
			if (inc.optional) {
				return;
			}
			try {
				await vscode.workspace.fs.stat(inc.resolved);
			} catch {
				out.push(
					diag(
						inc.targetRange,
						`Included file not found: ${inc.target}`,
					),
				);
			}
		}),
	);
	return out;
}
