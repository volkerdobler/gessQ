'use strict';

import * as vscode from 'vscode';
import type { IncludeDirective } from './includes';

/**
 * GESS Q. needs exactly one `script.q` per study – the web server loads that
 * file and nothing else. The "project" is therefore `script.q` plus whatever
 * it pulls in via `#include` / `#includeifexists` (transitively). Older copies
 * such as `script_v1.q` that happen to sit in the same folder are *not* part
 * of the project and must not contribute definitions or references.
 */
export const ROOT_SCRIPT = 'script.q';

/** True when `uri`'s basename is exactly `script.q` (case-insensitive). */
export function isRootScript(uri: vscode.Uri): boolean {
	const p = uri.path;
	return p.slice(p.lastIndexOf('/') + 1).toLowerCase() === ROOT_SCRIPT;
}

/**
 * Breadth-first transitive closure of `roots` over `#include` /
 * `#includeifexists`.
 *
 * `readIncludes(uri)` returns the file's include directives, or `undefined`
 * when the file cannot be read (a missing `#includeifexists` target, or a
 * broken `#include`) – those files are skipped, not listed. Cycles are
 * handled. The result keeps discovery order and lists every file once.
 */
export async function includeClosure(
	roots: readonly vscode.Uri[],
	readIncludes: (
		uri: vscode.Uri,
	) => Promise<readonly IncludeDirective[] | undefined>,
): Promise<vscode.Uri[]> {
	const seen = new Set<string>();
	const out: vscode.Uri[] = [];
	const queue: vscode.Uri[] = [...roots];

	while (queue.length > 0) {
		const uri = queue.shift() as vscode.Uri;
		const key = uri.toString();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);

		const includes = await readIncludes(uri);
		if (includes === undefined) {
			continue;
		}
		out.push(uri);
		for (const inc of includes) {
			queue.push(inc.resolved);
		}
	}
	return out;
}
