'use strict';

import * as vscode from 'vscode';
import { debug, warn } from './logger';

export interface GlossaryEntry {
	short: string;
	detail: string;
}

export type Glossary = Record<string, GlossaryEntry>;

let cache: Glossary | null = null;
let inFlight: Promise<Glossary> | null = null;

/**
 * Normalise a raw word into a glossary lookup key: lowercase, spaces to
 * hyphens, strip characters that never appear in keys.
 * @param s raw word
 */
export function normalizeKey(s: string): string {
	return s
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Candidate locations for `manualGlossary.json`, most-likely first.
 * `out/` is where the build step copies it; the `src/` path keeps the
 * dev host working before a build has run.
 * @param extensionUri root URI of the extension
 */
function candidateUris(extensionUri: vscode.Uri): vscode.Uri[] {
	return [
		vscode.Uri.joinPath(extensionUri, 'out', 'manualGlossary.json'),
		vscode.Uri.joinPath(
			extensionUri,
			'src',
			'commons',
			'manualGlossary.json',
		),
	];
}

/**
 * Load and cache the manual glossary. Safe to call repeatedly and
 * concurrently – the file is read at most once. Never rejects: on failure
 * an empty glossary is cached and returned.
 * @param extensionUri root URI of the extension (`context.extensionUri`)
 */
export async function loadGlossary(
	extensionUri: vscode.Uri,
): Promise<Glossary> {
	if (cache) {
		return cache;
	}
	if (inFlight) {
		return inFlight;
	}

	inFlight = (async () => {
		for (const uri of candidateUris(extensionUri)) {
			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const parsed = JSON.parse(
					Buffer.from(bytes).toString('utf8'),
				) as Glossary;
				cache = parsed;
				debug('glossary: loaded from ' + uri.fsPath);
				return cache;
			} catch {
				// try next candidate
			}
		}
		warn(
			'glossary: manualGlossary.json not found – hover and signature ' +
				'help will be limited',
		);
		cache = Object.create(null) as Glossary;
		return cache;
	})();

	return inFlight;
}

/**
 * Look up an entry for `word`, trying the direct lowercase key first and a
 * normalised key second.
 * @param glossary loaded glossary
 * @param word raw word under the cursor
 */
export function lookupEntry(
	glossary: Glossary,
	word: string,
): GlossaryEntry | undefined {
	const direct = glossary[word.toLowerCase()];
	if (direct) {
		return direct;
	}
	return glossary[normalizeKey(word.replace(/[()@:,]/g, ' '))];
}

/** Clear the in-memory glossary cache (used by tests). */
export function resetGlossaryCache(): void {
	cache = null;
	inFlight = null;
}
