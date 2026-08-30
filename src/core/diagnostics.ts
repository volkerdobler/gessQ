'use strict';

import * as vscode from 'vscode';
import { getCachedScope, ScopeEnum, isNotInCommentAt } from './scope';
import { parseDocumentSymbols, type IndexedSymbol } from './symbolIndex';
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
		close: /(?<!\w)#endmacro\b/i,
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

/**
 * One `#ifdef` / `#ifndef` guard.
 *
 * - `#ifdef X`      → `{ syms: ['x'], negated: false }`  – X defined
 * - `#ifdef [X Y]`  → `{ syms: ['x','y'], negated: false }` – X **or** Y defined
 * - `#ifndef X`     → `{ syms: ['x'], negated: true }`   – X not defined
 * - `#ifndef [X Y]` → `{ syms: ['x','y'], negated: true }` – neither X nor Y
 *
 * Stacked guards are AND-combined; `#else` flips `negated`.
 */
interface Guard {
	syms: string[];
	negated: boolean;
}

const COND_RE =
	/(?<!\w)#(ifdef|ifndef|else|endif)\b(?:\s*(\[[^\]\n]*\]|[A-Za-zÄÖÜäöüß_$][\w$]*))?/gi;

/** `X` / `[X Y]` / `[X, Y]` → lowercased symbol list. */
function parseGuardSyms(arg: string | undefined): string[] {
	if (!arg) {
		return [];
	}
	const inner = arg.startsWith('[') ? arg.slice(1, -1) : arg;
	return inner
		.split(/[\s,]+/)
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0);
}

/**
 * The conditional-compilation guard stack in effect at the *start* of every
 * line (index = line number). `#else` replaces the top guard with a flipped
 * copy rather than mutating it, so earlier snapshots stay valid.
 */
function guardStacksByLine(document: vscode.TextDocument): Guard[][] {
	const perLine: Guard[][] = [];
	const stack: Guard[] = [];

	for (let line = 0; line < document.lineCount; line++) {
		perLine[line] = stack.slice();
		const text = document.lineAt(line).text;
		COND_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = COND_RE.exec(text))) {
			if (!isNotInCommentAt(document, line, m.index)) {
				continue;
			}
			const kw = m[1].toLowerCase();
			if (kw === 'ifdef' || kw === 'ifndef') {
				stack.push({
					syms: parseGuardSyms(m[2]),
					negated: kw === 'ifndef',
				});
			} else if (kw === 'else') {
				const top = stack[stack.length - 1];
				if (top) {
					stack[stack.length - 1] = {
						syms: top.syms,
						negated: !top.negated,
					};
				}
			} else {
				stack.pop();
			}
		}
	}
	return perLine;
}

/**
 * Is the AND of `guards` unsatisfiable? Each guard is a CNF fragment: a
 * positive guard `{[X Y], false}` is the clause `(X ∨ Y)` (a bare `#ifdef X`
 * a unit `X`); a negated guard `{[X Y], true}` is the units `¬X`, `¬Y`. The
 * only negative literals are units, so unit propagation is a *complete*
 * UNSAT test for this class.
 */
function contradictory(guards: Guard[]): boolean {
	const mustBeTrue = new Set<string>();
	const mustBeFalse = new Set<string>();
	let clauses: string[][] = [];

	for (const g of guards) {
		const syms = g.syms.filter((s) => s !== '');
		if (g.negated) {
			for (const s of syms) {
				mustBeFalse.add(s);
			}
		} else if (syms.length === 1) {
			mustBeTrue.add(syms[0]);
		} else if (syms.length > 1) {
			clauses.push(syms);
		}
	}

	for (let changed = true; changed; ) {
		changed = false;
		for (const s of mustBeTrue) {
			if (mustBeFalse.has(s)) {
				return true;
			}
		}
		const next: string[][] = [];
		for (const c of clauses) {
			const open = c.filter((s) => !mustBeFalse.has(s));
			if (open.length === 0) {
				return true; // every literal ruled out
			}
			if (open.some((s) => mustBeTrue.has(s))) {
				changed = true; // clause satisfied, drop it
				continue;
			}
			if (open.length === 1) {
				mustBeTrue.add(open[0]);
				changed = true;
				continue;
			}
			next.push(open);
		}
		clauses = next;
	}
	return false;
}

/**
 * Two definitions cannot both be compiled in when the AND of their `#ifdef` /
 * `#ifndef` guards is unsatisfiable (e.g. `#ifdef X` vs `#ifndef X`). Anything
 * that *might* both be active – the `#define`s can come from outside – counts
 * as a clash.
 */
function mutuallyExclusive(a: Guard[], b: Guard[]): boolean {
	return contradictory([...a, ...b]);
}

/**
 * The same name defined twice in the same file – unless the two definitions
 * sit in mutually exclusive `#ifdef` / `#ifndef` branches.
 */
function checkDuplicates(document: vscode.TextDocument): vscode.Diagnostic[] {
	const guards = guardStacksByLine(document);
	const groups = new Map<
		string,
		{ symbol: IndexedSymbol; guard: Guard[] }[]
	>();

	for (const s of parseDocumentSymbols(document)) {
		if (s.category === 'action') {
			continue; // assignments are expected to repeat
		}
		const key = s.category + '|' + s.lower;
		const list = groups.get(key) ?? [];
		list.push({
			symbol: s,
			guard: guards[s.nameRange.start.line] ?? [],
		});
		groups.set(key, list);
	}

	const out: vscode.Diagnostic[] = [];
	for (const list of groups.values()) {
		for (let i = 1; i < list.length; i++) {
			const clashes = list
				.slice(0, i)
				.some((prev) => !mutuallyExclusive(prev.guard, list[i].guard));
			if (clashes) {
				const s = list[i].symbol;
				out.push(
					diag(
						s.nameRange,
						`Duplicate ${s.category} "${s.name}" (already defined above)`,
					),
				);
			}
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
