'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { isNotInCommentAt } from './scope';

/**
 * Search for a definition of `word` in a single file and return its Location
 * (the whole matching line). Rejects when nothing is found.
 * @param filename absolute path of the file to scan
 * @param word symbol to look for
 */
export async function getDefLocationInDocument(
	filename: string,
	word: string,
): Promise<vscode.Location> {
	const questionRe = parser.questionDefRe(word);
	const definitionRe = parser.definitionDefRe(word);
	const blockRe = parser.blockDefRe(word);

	const content = await vscode.workspace.openTextDocument(filename);
	let location: vscode.Location | undefined;

	for (let i = 0; i < content.lineCount; i++) {
		const line = content.lineAt(i);
		if (line.text.length === 0) {
			continue;
		}
		if (
			isNotInCommentAt(content, i, line.text.search(questionRe)) ||
			isNotInCommentAt(content, i, line.text.search(definitionRe)) ||
			isNotInCommentAt(content, i, line.text.search(blockRe))
		) {
			location = new vscode.Location(content.uri, line.range);
		}
	}

	if (!location) {
		return Promise.reject(new Error('No definition found'));
	}
	return location;
}

/**
 * Collect all Locations in `filename` that reference `word` (definitions and
 * usages across questions, blocks, checks, asserts, computes, action blocks).
 * @param filename absolute path of the file to scan
 * @param word symbol to look for
 */
export async function getAllLocationInDocument(
	filename: string,
	word: string,
): Promise<vscode.Location[]> {
	const patterns = [
		parser.questionDefRe(word),
		parser.definitionDefRe(word),
		parser.blockDefRe(word),
		parser.blockRe(word),
		parser.checkRe(word),
		parser.assertRe(word),
		parser.computeRe(word),
		parser.actionBlockDefRe(word),
	];

	const content = await vscode.workspace.openTextDocument(filename);
	const locations: vscode.Location[] = [];

	for (let i = 0; i < content.lineCount; i++) {
		const line = content.lineAt(i);
		if (line.text.length === 0) {
			continue;
		}
		if (
			patterns.some((re) =>
				isNotInCommentAt(content, i, line.text.search(re)),
			)
		) {
			locations.push(new vscode.Location(content.uri, line.range));
		}
	}

	return locations;
}
