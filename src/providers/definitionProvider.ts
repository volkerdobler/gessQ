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
import { getDefLocationInDocument } from '../core/symbolSearch';

/**
 * "Go to Definition" (F12) for gessQ symbols: scans every `.q` file in the
 * workspace folder for a definition of the word under the cursor.
 */
export class GessQDefinitionProvider implements vscode.DefinitionProvider {
	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): Thenable<vscode.Location> {
		return new Promise((resolve, reject) => {
			const [found, word] = getWordAtPosition(document, position);
			if (!found) {
				reject(new Error('No definition found'));
				return;
			}

			const wsFolder =
				getWorkspaceFolderPath(document.uri) ||
				fixDriveCasingInWindows(path.dirname(document.fileName));

			const fileNames = getAllFilenamesInDirectory(wsFolder, 'q');
			if (fileNames.length === 0) {
				reject(new Error('No Q-files found'));
				return;
			}

			Promise.allSettled(
				fileNames.map((file) => getDefLocationInDocument(file, word)),
			).then((results) => {
				const hit = results.find(
					(r): r is PromiseFulfilledResult<vscode.Location> =>
						r.status === 'fulfilled' && Boolean(r.value),
				);
				if (hit) {
					resolve(hit.value);
				} else {
					reject(new Error('No definition found'));
				}
			});
		});
	}
}
