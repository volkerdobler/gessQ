'use strict';

import * as vscode from 'vscode';

/**
 * Return the word under `position` and an adjusted position inside the word.
 * @returns tuple `[found, word, adjustedPosition]`
 */
export function getWordAtPosition(
	document: vscode.TextDocument,
	position: vscode.Position,
): [boolean, string, vscode.Position] {
	const wordRange = document.getWordRangeAtPosition(position);
	const word = wordRange ? document.getText(wordRange) : '';
	if (!wordRange) {
		return [false, '', position];
	}
	if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
		position = position.translate(0, -1);
	}

	return [true, word, position];
}
