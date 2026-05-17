'use strict';

import * as vscode from 'vscode';

export interface Delimiter {
	start: string;
	end: string;
}

export let lineCommentDelimiter: RegExp = /\/\//;
export let blockCommentDelimiter: Array<Delimiter> = [
	{ start: '/*', end: '*/' },
];
export let stringDelimiter: Array<Delimiter> = [
	{ start: '"', end: '"' },
	{ start: "'", end: "'" },
];

/**
 * Set the line comment delimiter regex (e.g. /\/\//).
 * @param reg regex that matches the start of a line comment
 */
export function setLineCommentDelimiter(reg: RegExp): void {
	lineCommentDelimiter = reg;
}

/**
 * Set the array of block comment delimiters.
 * @param arr array of `{start,end}` delimiters
 */
export function setBlockCommentDelimiter(arr: Array<Delimiter>): void {
	blockCommentDelimiter = arr;
}

/**
 * Set the array of string delimiters.
 * @param arr array of `{start,end}` string delimiters
 */
export function setStringDelimiter(arr: Array<Delimiter>): void {
	stringDelimiter = arr;
}

/**
 * Escape a string for safe usage inside a regular expression.
 * @param str input string
 * @returns escaped string
 */
export function escapeRegex(str: string): string {
	return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Find a block comment start at the beginning of `str`.
 * @param str string to test
 * @returns tuple `[matchLength, delimiterIndex]` or `[-1,-1]` when not found
 */
export function findBlockCommentStart(str: string): [number, number] {
	let result = -1;
	let cType = -1;

	blockCommentDelimiter.forEach(
		/**
		 * Callback: test whether `str` begins with the block comment start.
		 */
		function (value, index) {
			if (str.search(escapeRegex(value.start)) === 0) {
				result = value.start.length;
				cType = index;
			}
		},
	);

	return [result, cType];
}

/**
 * Find a block comment end at the beginning of `str` matching `comIndex`.
 * @param str string to test
 * @param comIndex index of the block comment delimiter to match
 * @returns length of matched end delimiter or -1
 */
export function findBlockCommentEnd(str: string, comIndex: number): number {
	let result = -1;

	blockCommentDelimiter.forEach(
		/**
		 * Callback: test whether `str` begins with the block comment end for the given index.
		 */
		function (value, index) {
			if (
				str.search(escapeRegex(value.end)) === 0 &&
				index === comIndex
			) {
				result = value.end.length;
			}
		},
	);

	return result;
}

/**
 * Find a string start at the beginning of `str`.
 * @param str string to test
 * @returns tuple `[matchLength, stringDelimiterIndex]` or `[-1,-1]`
 */
export function findStringStart(str: string): [number, number] {
	let result = -1;
	let sIndex = -1;

	stringDelimiter.forEach(
		/**
		 * Callback: test whether `str` begins with a string start delimiter.
		 */
		function (value, index) {
			if (str.search(escapeRegex(value.start)) === 0) {
				result = value.start.length;
				sIndex = index;
			}
		},
	);

	return [result, sIndex];
}

/**
 * Find a string end at the beginning of `str` matching `sIndex`.
 * @param str string to test
 * @param sIndex index of the string delimiter to match
 * @returns length of matched end delimiter or -1
 */
export function findStringEnd(str: string, sIndex: number): number {
	let result = -1;

	stringDelimiter.forEach(
		/**
		 * Callback: test whether `str` begins with a string end delimiter for the given index.
		 */
		function (value, index) {
			if (str.search(escapeRegex(value.end)) === 0 && index === sIndex) {
				result = value.end.length;
			}
		},
	);

	return result;
}
