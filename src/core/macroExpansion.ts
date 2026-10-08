'use strict';

import type * as vscode from 'vscode';
import { getCachedScope } from './scope';

/** One `&NAME;$p=v;$q="w";` macro call with its `$` parameters. */
export interface MacroCall {
	macro: string;
	/** Parameter name (without `$`) → value (quotes stripped). */
	params: Map<string, string>;
}

/** `&NAME;` – a macro call. */
const CALL_RE = /&([A-Za-z_][A-Za-z0-9_]*);/g;
/** `$name=value;` directly after a call (value bare or quoted). */
const PARAM_RE =
	/\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^;\s]*)\s*;?/y;
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const callsCache = new Map<string, { version: number; calls: MacroCall[] }>();

/**
 * Macro calls with `$` parameters in `document`, e.g. `&mcrF1;$z=2`. Calls
 * without parameters are skipped – they cannot instantiate a `$` template.
 * Memoised per document version.
 */
export function parseMacroCalls(document: vscode.TextDocument): MacroCall[] {
	const key = document.uri.toString();
	const hit = callsCache.get(key);
	if (hit && hit.version === document.version) {
		return hit.calls;
	}

	const scope = getCachedScope(document);
	const calls: MacroCall[] = [];
	for (let line = 0; line < document.lineCount; line++) {
		const text = document.lineAt(line).text;
		if (!text.includes('&')) {
			continue;
		}
		CALL_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = CALL_RE.exec(text))) {
			if (!scope.isNotInComment(line, m.index)) {
				continue;
			}
			const params = new Map<string, string>();
			PARAM_RE.lastIndex = CALL_RE.lastIndex;
			let p: RegExpExecArray | null;
			while ((p = PARAM_RE.exec(text)) && p[0].length > 0) {
				const v = p[2];
				params.set(p[1], /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);
				CALL_RE.lastIndex = PARAM_RE.lastIndex;
			}
			if (params.size > 0) {
				calls.push({ macro: m[1], params });
			}
		}
	}

	callsCache.set(key, { version: document.version, calls });
	return calls;
}

/**
 * The names the given calls create from the macros' `$` templates: with
 * `#macro m` defining `singleq f1_$z;`, the call `&m;$z=2` yields `f1_2`.
 * Templates with a parameter the call does not set are skipped.
 */
export function expandMacroNames(
	macros: readonly { name: string; templates?: string[] }[],
	calls: readonly MacroCall[],
): Set<string> {
	const templatesOf = new Map<string, string[]>();
	for (const m of macros) {
		if (m.templates?.length) {
			templatesOf.set(m.name, [
				...(templatesOf.get(m.name) ?? []),
				...m.templates,
			]);
		}
	}

	const out = new Set<string>();
	for (const call of calls) {
		const templates = templatesOf.get(call.macro);
		if (!templates) {
			continue;
		}
		// Longest parameter first, so `$zz` is not read as `$z` + `z`.
		const params = [...call.params].sort(
			(a, b) => b[0].length - a[0].length,
		);
		for (const t of templates) {
			let name = t;
			for (const [k, v] of params) {
				name = name.split('$' + k).join(v);
			}
			if (VALID_NAME.test(name)) {
				out.add(name);
			}
		}
	}
	return out;
}
