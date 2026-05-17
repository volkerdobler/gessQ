'use strict';

import * as path from 'path';
import * as fs from 'fs';

/**
 * Fixes drive letter casing on Windows paths. Returns unchanged path on other platforms.
 * @param pathToFix path to normalize
 */
export function fixDriveCasingInWindows(pathToFix: string): string {
	return process.platform === 'win32' && pathToFix
		? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1)
		: pathToFix;
}

/**
 * Recursively collect filenames with the given extension from `dir`.
 * @param dir root directory to scan
 * @param fType file extension (without leading dot or a regex group)
 */
export function getAllFilenamesInDirectory(
	dir: string,
	fType: string,
): string[] {
	let results: string[] = [];
	const regEXP = new RegExp('\\.' + fType + '$', 'i');
	const list = fs.readdirSync(dir, {
		encoding: 'utf8',
		withFileTypes: true,
	});

	list.forEach(function (file: fs.Dirent) {
		const fileInclDir = path.join(dir, file.name);
		if (file.isDirectory()) {
			results = results.concat(
				getAllFilenamesInDirectory(fileInclDir, fType),
			);
		} else {
			if (file.isFile() && file.name.match(regEXP)) {
				results.push(fileInclDir);
			}
		}
	});
	return results;
}
