'use strict';

import * as vscode from 'vscode';
import {
	Delimiter,
	lineCommentDelimiter,
	blockCommentDelimiter,
	stringDelimiter,
	setLineCommentDelimiter,
	setBlockCommentDelimiter,
	setStringDelimiter,
	findBlockCommentStart,
	findBlockCommentEnd,
	findStringStart,
	findStringEnd,
} from '../commons/scopeUtils';

export enum ScopeEnum {
	normal,
	comment,
	string,
}

/**
 * Scans a document and records per-character scopes (normal, comment, string).
 */
export class Scope {
	private scopeArr: ScopeEnum[][] = [];

	constructor(
		document: vscode.TextDocument,
		lineComDel?: RegExp,
		BlCoDel?: Array<Delimiter>,
		strReg?: Array<Delimiter>,
	) {
		/**
		 * Create a new Scope scanner for `document`.
		 * @param document the document to scan
		 * @param lineComDel optional custom line comment regex
		 * @param BlCoDel optional block comment delimiters
		 * @param strReg optional string delimiters
		 */
		if (lineComDel) {
			setLineCommentDelimiter(lineComDel);
		}
		if (BlCoDel) {
			setBlockCommentDelimiter(BlCoDel);
		}
		if (strReg) {
			setStringDelimiter(strReg);
		}

		let currScope: ScopeEnum = ScopeEnum.normal;

		let comIndex = -1;
		let strIndex = -1;
		let lineComment = false;

		for (let line = 0; line < document.lineCount; line++) {
			this.scopeArr[line] = [];

			const lineStr = document.lineAt(line).text;

			if (lineStr.length === 0) {
				continue;
			}

			let char = 0;

			while (char < lineStr.length) {
				let comStart = -1;
				let comEnde = -1;
				let strStart = -1;
				let strEnde = -1;

				switch (currScope) {
					case ScopeEnum.normal:
						lineComment =
							lineStr
								.substring(char)
								.search(lineCommentDelimiter) === 0;
						[strStart, strIndex] = findStringStart(
							lineStr.substring(char),
						);
						[comStart, comIndex] = findBlockCommentStart(
							lineStr.substring(char),
						);
						break;
					case ScopeEnum.string:
						strEnde = findStringEnd(
							lineStr.substring(char),
							strIndex,
						);
						break;
					case ScopeEnum.comment:
						comEnde = findBlockCommentEnd(
							lineStr.substring(char),
							comIndex,
						);
						break;
				}

				if (lineComment) {
					for (let loop = 0; loop < lineStr.length; loop++) {
						this.scopeArr[line][char + loop] = ScopeEnum.comment;
					}
					break;
				}

				if (comStart > -1) {
					for (
						let loop = 0;
						loop < blockCommentDelimiter[comIndex].start.length;
						loop++
					) {
						this.scopeArr[line][char + loop] = ScopeEnum.comment;
					}
					char += blockCommentDelimiter[comIndex].start.length;
					currScope = ScopeEnum.comment;
				}

				if (comEnde > -1) {
					for (
						let loop = 0;
						loop < blockCommentDelimiter[comIndex].end.length;
						loop++
					) {
						this.scopeArr[line][char + loop] = ScopeEnum.comment;
					}
					char += blockCommentDelimiter[comIndex].end.length;
					currScope = ScopeEnum.normal;
					comIndex = -1;
				}

				if (strStart > -1) {
					for (
						let loop = 0;
						loop < stringDelimiter[strIndex].start.length;
						loop++
					) {
						this.scopeArr[line][char + loop] = ScopeEnum.string;
					}
					char += stringDelimiter[strIndex].start.length;
					currScope = ScopeEnum.string;
				}

				if (strEnde > -1) {
					for (
						let loop = 0;
						loop < stringDelimiter[strIndex].end.length;
						loop++
					) {
						this.scopeArr[line][char + loop] = ScopeEnum.string;
					}
					char += stringDelimiter[strIndex].end.length;
					currScope = ScopeEnum.normal;
					strIndex = -1;
				}

				if (
					comStart === -1 &&
					comEnde === -1 &&
					strStart === -1 &&
					strEnde === -1
				) {
					this.scopeArr[line][char] = currScope;
					char++;
				}
			}
		}
	}

	/**
	 * Get the scope enum at the given line/char coordinates.
	 * @param x line number (0-based)
	 * @param y character index (0-based)
	 */
	public getScope(x: number, y: number): ScopeEnum | undefined {
		return x >= 0 &&
			x < this.scopeArr.length &&
			y >= 0 &&
			y < this.scopeArr[x].length
			? this.scopeArr[x][y]
			: undefined;
	}

	/**
	 * Return true when position is in normal (non-comment, non-string) scope.
	 */
	public isNormalScope(x: number, y: number): boolean {
		return this.getScope(x, y) === ScopeEnum.normal;
	}

	/**
	 * Return true when position is inside a comment scope.
	 */
	public isCommentScope(x: number, y: number): boolean {
		return this.getScope(x, y) === ScopeEnum.comment;
	}

	/**
	 * Return true when position is not inside a comment (normal or string).
	 */
	public isNotInComment(x: number, y: number): boolean {
		return this.isNormalScope(x, y) || this.isStringScope(x, y);
	}

	/**
	 * Return true when position is inside a string scope.
	 */
	public isStringScope(x: number, y: number): boolean {
		return this.getScope(x, y) === ScopeEnum.string;
	}
}

/**
 * Compute the scope at a specific document position by scanning up to that point.
 * Useful when no cached Scope is available.
 * @param document document to inspect
 * @param line line number (0-based)
 * @param ch character index (0-based)
 */
export function getScopeAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): ScopeEnum | undefined {
	if (line < 0 || line >= document.lineCount) {
		return undefined;
	}
	if (ch < 0) {
		return undefined;
	}

	let curr: ScopeEnum = ScopeEnum.normal;
	let strDelim: string | null = null;
	let commentType: 'line' | 'block' | null = null;

	for (let l = 0; l <= line; l++) {
		const text = document.lineAt(l).text;
		const maxIndex = l === line ? Math.min(ch, text.length) : text.length;
		let i = 0;

		while (i < maxIndex) {
			const c = text[i];

			if (curr === ScopeEnum.normal) {
				if (c === '/' && i + 1 < text.length) {
					const n = text[i + 1];
					if (n === '/') {
						curr = ScopeEnum.comment;
						commentType = 'line';
						i = maxIndex;
						continue;
					}
					if (n === '*') {
						curr = ScopeEnum.comment;
						commentType = 'block';
						i += 2;
						continue;
					}
				}
				if ((c === '"' || c === "'") && commentType === null) {
					curr = ScopeEnum.string;
					strDelim = c;
					i++;
					continue;
				}
				i++;
				continue;
			}

			if (curr === ScopeEnum.comment) {
				if (commentType === 'block') {
					if (
						c === '*' &&
						i + 1 < text.length &&
						text[i + 1] === '/'
					) {
						curr = ScopeEnum.normal;
						commentType = null;
						i += 2;
						continue;
					}
					i++;
					continue;
				} else {
					i = maxIndex;
					continue;
				}
			}

			if (curr === ScopeEnum.string) {
				if (c === strDelim) {
					let bs = 0;
					let k = i - 1;
					while (k >= 0 && text[k] === '\\') {
						bs++;
						k--;
					}
					if (bs % 2 === 0) {
						curr = ScopeEnum.normal;
						strDelim = null;
					}
				}
				i++;
				continue;
			}
		}
	}

	return curr;
}

const scopeCache: Map<string, { version: number; scope: Scope }> = new Map();

export let cacheDebug: boolean = false;

/**
 * Build a cache key for the given document.
 * @param document document to key
 */
function cacheKey(document: vscode.TextDocument): string {
	return document.uri.toString();
}

/**
 * Return a cached Scope for `document`, or compute and cache a new one.
 * @param document document to scan
 */
export function getCachedScope(document: vscode.TextDocument): Scope {
	const key = cacheKey(document);
	const entry = scopeCache.get(key);
	if (entry && entry.version === document.version) {
		if (cacheDebug) {
			console.debug(
				'[scope] cache hit',
				key,
				'version',
				document.version,
			);
		}
		return entry.scope;
	}
	const s = new Scope(document);
	scopeCache.set(key, { version: document.version, scope: s });
	if (cacheDebug) {
		console.debug('[scope] cache set', key, 'version', document.version);
	}
	return s;
}

/**
 * Clear the scope cache. If `document` is provided, only that entry is cleared.
 */
export function clearScopeCache(document?: vscode.TextDocument): void {
	if (document) {
		if (cacheDebug) {
			console.debug('[scope] cache clear', cacheKey(document));
		}
		scopeCache.delete(cacheKey(document));
	} else {
		if (cacheDebug) {
			console.debug('[scope] cache clear all');
		}
		scopeCache.clear();
	}
}

/**
 * Retrieve scope from cache when available; otherwise scan the document.
 * @param document document to inspect
 * @param line line number (0-based)
 * @param ch character index (0-based)
 */
function getScopeUsingCacheOrScan(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): ScopeEnum | undefined {
	const key = cacheKey(document);
	const entry = scopeCache.get(key);
	if (entry && entry.version === document.version) {
		return entry.scope.getScope(line, ch);
	}
	return getScopeAt(document, line, ch);
}

/**
 * Return true when the given position is not inside a comment.
 */
export function isNotInCommentAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	const s = getScopeUsingCacheOrScan(document, line, ch);
	return s === ScopeEnum.normal || s === ScopeEnum.string;
}

/**
 * Return true when the given position is inside a comment.
 */
export function isCommentAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	return getScopeUsingCacheOrScan(document, line, ch) === ScopeEnum.comment;
}

/**
 * Return true when the given position is inside a string.
 */
export function isStringAt(
	document: vscode.TextDocument,
	line: number,
	ch: number,
): boolean {
	return getScopeUsingCacheOrScan(document, line, ch) === ScopeEnum.string;
}
