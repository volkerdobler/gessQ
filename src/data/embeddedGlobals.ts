'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';
import { debug, warn } from '../infra/logger';

/**
 * Loader for `gessq-globals.d.ts` – the ambient declarations appended to the
 * virtual TypeScript document built for every embedded `javascript = "…"` /
 * `jsHandler = "…"` block (see {@link ../providers/embeddedLanguage} and
 * {@link ../core/embeddedRegions}).
 *
 * Read synchronously so the globals are in place before the first virtual
 * document is handed to the TypeScript service – it caches what it first reads.
 * Never throws: on failure a small inline fallback is used so `QDot` / `$` /
 * `_i_` still resolve.
 */

/** Enough to keep the common globals from turning red when the file is missing. */
const FALLBACK = [
	'declare const _i_: any;',
	'declare var QDot: any;',
	'declare var Android: any;',
	'declare var $: any;',
	'declare var jQuery: any;',
].join('\n');

let cache: string | null = null;

/**
 * Candidate locations for `gessq-globals.d.ts`, most-likely first: `out/` is
 * where the build step copies it, the `assets/` path keeps the dev host working
 * before a build has run.
 */
function candidatePaths(extensionUri: vscode.Uri): string[] {
	const root = extensionUri.fsPath;
	return [
		root + '/out/gessq-globals.d.ts',
		root + '/assets/gessq-globals.d.ts',
	];
}

/** Load and cache the ambient globals text. Safe to call repeatedly. */
export function loadEmbeddedGlobals(extensionUri: vscode.Uri): string {
	if (cache !== null) {
		return cache;
	}
	for (const path of candidatePaths(extensionUri)) {
		try {
			cache = fs.readFileSync(path, 'utf8');
			debug('embeddedGlobals: loaded from ' + path);
			return cache;
		} catch {
			// try next candidate
		}
	}
	warn(
		'embeddedGlobals: gessq-globals.d.ts not found – embedded-JS ' +
			'completion / hover will lack the GESS Q. globals',
	);
	cache = FALLBACK;
	return cache;
}

/** Clear the in-memory cache (used by tests). */
export function resetEmbeddedGlobalsCache(): void {
	cache = null;
}
