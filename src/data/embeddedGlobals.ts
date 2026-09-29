'use strict';

import * as fs from 'fs';
import * as path from 'path';
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

// ---------------------------------------------------------------------------
// User declaration files (`gessq.embeddedLanguages.declarationFiles`)
// ---------------------------------------------------------------------------

/**
 * Resolve one configured declaration path: `~` / `${userHome}` → home dir,
 * `${workspaceFolder}` → first workspace folder, a relative path → relative to
 * that folder. `undefined` when the path needs a workspace folder and there is
 * none.
 */
export function resolveDeclarationPath(
	raw: string,
	workspaceFolder: string | undefined,
	home: string,
): string | undefined {
	let p = raw.replace(/\$\{userHome\}/g, home);
	if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
		p = home + p.slice(1);
	}
	if (p.includes('${workspaceFolder}')) {
		if (workspaceFolder === undefined) {
			return undefined;
		}
		p = p.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
	}
	if (path.isAbsolute(p)) {
		return path.normalize(p);
	}
	return workspaceFolder === undefined
		? undefined
		: path.resolve(workspaceFolder, p);
}

/** What {@link loadUserDeclarations} read, plus what to watch for changes. */
export interface UserDeclarations {
	/** Concatenated file contents, each headed by a `// --- path ---` line. */
	text: string;
	/** Directory + glob pairs to watch (also for files that don't exist yet). */
	watch: { dir: string; pattern: string }[];
}

/**
 * Read the configured declaration files. A file is taken as is; a folder
 * contributes every `*.d.ts` directly inside it, in name order. Missing or
 * unreadable entries are logged and skipped – never throws.
 */
export function loadUserDeclarations(
	rawPaths: readonly string[],
	workspaceFolder: string | undefined,
	home: string,
): UserDeclarations {
	const parts: string[] = [];
	const watch: UserDeclarations['watch'] = [];
	const read = (file: string): void => {
		try {
			parts.push('// --- ' + file + ' ---\n' + fs.readFileSync(file, 'utf8'));
			debug('embeddedGlobals: loaded declarations from ' + file);
		} catch (e) {
			warn('embeddedGlobals: cannot read ' + file + ': ' + String(e));
		}
	};
	for (const raw of rawPaths) {
		const resolved = resolveDeclarationPath(raw, workspaceFolder, home);
		if (resolved === undefined) {
			warn(
				'embeddedGlobals: "' +
					raw +
					'" is relative but no workspace folder is open – skipped',
			);
			continue;
		}
		let isDir = false;
		try {
			isDir = fs.statSync(resolved).isDirectory();
		} catch {
			warn('embeddedGlobals: declaration file not found: ' + resolved);
			// still watched below, so it is picked up once it is created
		}
		if (isDir) {
			watch.push({ dir: resolved, pattern: '*.d.ts' });
			let names: string[] = [];
			try {
				names = fs
					.readdirSync(resolved)
					.filter((n) => n.toLowerCase().endsWith('.d.ts'))
					.sort();
			} catch (e) {
				warn('embeddedGlobals: cannot list ' + resolved + ': ' + String(e));
			}
			for (const n of names) {
				read(path.join(resolved, n));
			}
		} else {
			watch.push({
				dir: path.dirname(resolved),
				pattern: path.basename(resolved),
			});
			if (fs.existsSync(resolved)) {
				read(resolved);
			}
		}
	}
	return { text: parts.join('\n'), watch };
}

/** Clear the in-memory cache (used by tests). */
export function resetEmbeddedGlobalsCache(): void {
	cache = null;
}
