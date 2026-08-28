'use strict';

import * as vscode from 'vscode';

/**
 * Lexical scope of a character in a gessQ document.
 */
export enum ScopeEnum {
	normal,
	comment,
	string,
}

/**
 * Scans a whole document once and records the {@link ScopeEnum} of every
 * character. Line comments (`//`) reset at the end of a line; block comments
 * (`/* *\/`) and string literals (`"…"`, `'…'`) may span multiple lines. A
 * backslash inside a string escapes the following character, so `\"` does not
 * terminate a double-quoted string.
 */
export class Scope {
	private readonly rows: ScopeEnum[][] = [];

	constructor(document: vscode.TextDocument) {
		type State = 'normal' | 'block' | 'string';
		let state: State = 'normal';
		let stringDelim = '';

		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			const row: ScopeEnum[] = new Array(text.length);
			this.rows[line] = row;

			let lineComment = false;
			let i = 0;

			while (i < text.length) {
				const c = text[i];
				const next = i + 1 < text.length ? text[i + 1] : '';

				if (lineComment) {
					row[i] = ScopeEnum.comment;
					i++;
					continue;
				}

				if (state === 'normal') {
					if (c === '/' && next === '/') {
						lineComment = true;
						row[i] = ScopeEnum.comment;
						i++;
						continue;
					}
					if (c === '/' && next === '*') {
						row[i] = ScopeEnum.comment;
						row[i + 1] = ScopeEnum.comment;
						i += 2;
						state = 'block';
						continue;
					}
					if (c === '"' || c === "'") {
						row[i] = ScopeEnum.string;
						stringDelim = c;
						i++;
						state = 'string';
						continue;
					}
					row[i] = ScopeEnum.normal;
					i++;
					continue;
				}

				if (state === 'block') {
					if (c === '*' && next === '/') {
						row[i] = ScopeEnum.comment;
						row[i + 1] = ScopeEnum.comment;
						i += 2;
						state = 'normal';
						continue;
					}
					row[i] = ScopeEnum.comment;
					i++;
					continue;
				}

				// state === 'string'
				row[i] = ScopeEnum.string;
				if (c === '\\') {
					if (i + 1 < text.length) {
						row[i + 1] = ScopeEnum.string;
						i += 2;
						continue;
					}
					i++;
					continue;
				}
				if (c === stringDelim) {
					state = 'normal';
				}
				i++;
			}
		}
	}

	/**
	 * Scope at `line`/`ch` (both 0-based), or `undefined` when out of range
	 * (a negative `ch` – e.g. from `String.search` returning `-1` – included).
	 */
	public getScope(line: number, ch: number): ScopeEnum | undefined {
		const row = this.rows[line];
		if (!row || ch < 0 || ch >= row.length) {
			return undefined;
		}
		return row[ch];
	}

	/** True when the position is outside of any comment (normal or string). */
	public isNotInComment(line: number, ch: number): boolean {
		const s = this.getScope(line, ch);
		return s === ScopeEnum.normal || s === ScopeEnum.string;
	}

	/** True when the position is inside a comment. */
	public isComment(line: number, ch: number): boolean {
		return this.getScope(line, ch) === ScopeEnum.comment;
	}

	/** True when the position is inside a string literal. */
	public isString(line: number, ch: number): boolean {
		return this.getScope(line, ch) === ScopeEnum.string;
	}
}

const scopeCache = new Map<string, { version: number; scope: Scope }>();

/**
 * Return a cached {@link Scope} for `document`, recomputing it when the
 * document version changed.
 */
export function getCachedScope(document: vscode.TextDocument): Scope {
	const key = document.uri.toString();
	const entry = scopeCache.get(key);
	if (entry && entry.version === document.version) {
		return entry.scope;
	}
	const scope = new Scope(document);
	scopeCache.set(key, { version: document.version, scope });
	return scope;
}

/** Drop the cache entry for `document`, or the whole cache when omitted. */
export function clearScopeCache(document?: vscode.TextDocument): void {
	if (document) {
		scopeCache.delete(document.uri.toString());
	} else {
		scopeCache.clear();
	}
}

/** True when `line`/`ch` in `document` is not inside a comment. */
export function isNotInCommentAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	return getCachedScope(document).isNotInComment(line, ch);
}

/** True when `line`/`ch` in `document` is inside a comment. */
export function isCommentAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	return getCachedScope(document).isComment(line, ch);
}

/** True when `line`/`ch` in `document` is inside a string literal. */
export function isStringAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	return getCachedScope(document).isString(line, ch);
}
