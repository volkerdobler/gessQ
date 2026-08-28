'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import {
	getAllFilenamesInDirectory,
	fixDriveCasingInWindows,
} from '../infra/fsUtils';
import {
	getWordAtPosition,
	getWorkspaceFolderPath,
} from '../infra/vscodeUtils';
import { getAllLocationInDocument } from '../core/symbolSearch';

/**
 * "Find All References" (Shift+F12) for gessQ symbols.
 */
export class GessQReferenceProvider implements vscode.ReferenceProvider {
	public provideReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		_options: { includeDeclaration: boolean },
		_token: vscode.CancellationToken,
	): Thenable<vscode.Location[]> {
		return new Promise((resolve) => {
			const [found, word] = getWordAtPosition(document, position);
			if (!found) {
				resolve([]);
				return;
			}

			const wsFolder =
				getWorkspaceFolderPath(document.uri) ||
				fixDriveCasingInWindows(path.dirname(document.fileName));

			const fileNames = getAllFilenamesInDirectory(wsFolder, 'q');

			Promise.allSettled(
				fileNames.map((file) => getAllLocationInDocument(file, word)),
			).then((results) => {
				const locations: vscode.Location[] = [];
				for (const r of results) {
					if (r.status === 'fulfilled') {
						locations.push(...r.value);
					}
				}
				resolve(locations);
			});
		});
	}
}
