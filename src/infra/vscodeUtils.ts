'use strict';

import * as vscode from 'vscode';
import { fixDriveCasingInWindows } from './fsUtils';

/**
 * Resolve the workspace folder path that contains `fileUri`. When no URI is
 * given, falls back to the first workspace folder. Returns `undefined` when
 * neither can be determined.
 */
export function getWorkspaceFolderPath(
	fileUri?: vscode.Uri,
): string | undefined {
	if (fileUri) {
		const folder = vscode.workspace.getWorkspaceFolder(fileUri);
		return folder ? fixDriveCasingInWindows(folder.uri.fsPath) : undefined;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length) {
		return fixDriveCasingInWindows(folders[0].uri.fsPath);
	}
	return undefined;
}

/**
 * Return the word under `position` and an adjusted position inside the word.
 * @returns tuple `[found, word, adjustedPosition]`
 */
export function getWordAtPosition(
	document: vscode.TextDocument,
	position: vscode.Position,
): [boolean, string, vscode.Position] {
	// Try to get an automatic word range at the exact position first.
	let wordRange = document.getWordRangeAtPosition(position);
	// If nothing found, try a small leftward fallback (hover often reports end-of-word).
	if (!wordRange) {
		for (let i = 1; i <= 3; i++) {
			if (position.character - i < 0) {
				break;
			}
			const p = position.translate(0, -i);
			wordRange = document.getWordRangeAtPosition(p);
			if (wordRange) {
				// adjust reported position to be inside found word
				position = p;
				break;
			}
		}
	}
	const word = wordRange ? document.getText(wordRange) : '';
	if (!wordRange) {
		return [false, '', position];
	}
	if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
		position = position.translate(0, -1);
	}

	return [true, word, position];
}
