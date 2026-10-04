'use strict';

/**
 * `@default` values from the TypeScript declarations used in embedded
 * `javascript = "…"` blocks (built-in globals + `gessq.embeddedLanguages.
 * declarationFiles`), so completing an option inside an object literal can
 * insert `name: <default>` with the value selected.
 *
 * A deliberately small parser: it reads `/** … @default X *\/ name?: Type;`
 * members and remembers the nearest preceding `interface` – enough for
 * hand-written option interfaces, no TypeScript compiler needed.
 */

export interface PropertyDefault {
	iface: string;
	name: string;
	/** The member's type text, e.g. `'board' | 'cardstack'`. */
	type: string;
	/** The `@default` text as written, e.g. `2`, `'board'`, `null`. */
	value: string;
}

export type DeclarationDefaults = ReadonlyMap<string, PropertyDefault[]>;

const MEMBER_RE =
	/\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*([^;]+);/g;
const INTERFACE_RE = /\binterface\s+([A-Za-z_$][\w$]*)/g;

/** Every documented `@default`, keyed by property name. */
export function parseDeclarationDefaults(text: string): DeclarationDefaults {
	const interfaces: { at: number; name: string }[] = [];
	for (const m of text.matchAll(INTERFACE_RE)) {
		interfaces.push({ at: m.index, name: m[1] });
	}

	const out = new Map<string, PropertyDefault[]>();
	for (const m of text.matchAll(MEMBER_RE)) {
		const def = /@default[ \t]+([^\n]*?)[ \t]*(?:\n|$)/.exec(m[1]);
		if (!def || def[1] === '') {
			continue;
		}
		const iface =
			interfaces.filter((i) => i.at < m.index).pop()?.name ?? '';
		const entry: PropertyDefault = {
			iface,
			name: m[2],
			type: m[3].trim(),
			value: def[1].replace(/^\*\s*/, ''),
		};
		const list = out.get(entry.name) ?? [];
		list.push(entry);
		out.set(entry.name, list);
	}
	return out;
}

/**
 * The default for property `name`. When several interfaces declare it with
 * different defaults, the completion item's `detail` (`(property)
 * CogmapSettings.initialGroups?: number`) decides; without it there is no
 * answer.
 */
export function lookupDefault(
	defaults: DeclarationDefaults,
	name: string,
	detail?: string,
): PropertyDefault | undefined {
	const list = defaults.get(name);
	if (!list || list.length === 0) {
		return undefined;
	}
	if (list.every((d) => d.value === list[0].value)) {
		return list[0];
	}
	return detail
		? list.find((d) => detail.includes(`${d.iface}.${name}`))
		: undefined;
}

const escapePlaceholder = (s: string) => s.replace(/[$}\\]/g, '\\$&');
const escapeChoice = (s: string) => s.replace(/[$}\\,|]/g, '\\$&');

/** `'a' | 'b'` → `['a', 'b']`, or `undefined` unless every part is a string literal. */
function stringLiterals(type: string): string[] | undefined {
	const parts = type.split('|').map((p) => p.trim());
	const values: string[] = [];
	for (const p of parts) {
		const m = /^(['"])(.*)\1$/.exec(p);
		if (!m) {
			return undefined;
		}
		values.push(m[2]);
	}
	return values;
}

/**
 * JS string quote for `inner` inside a GESS Q. `javascript = "…"` block: a
 * plain `"` would end the Q. string, so `'` – or the Q. escape `\"` when the
 * text itself contains a `'` (written `\\"` in snippet syntax).
 */
const jsQuote = (inner: string) => (inner.includes("'") ? '\\\\"' : "'");

/**
 * The value part of the snippet: the default as selected placeholder (typing
 * replaces it, Tab keeps it); string-literal unions and `boolean` become a
 * choice with the default first.
 */
function valueSnippet(p: PropertyDefault): string {
	const quoted = /^(['"])(.*)\1$/.exec(p.value);
	const literals = stringLiterals(p.type);

	if (literals && quoted && literals.includes(quoted[2])) {
		const options = [quoted[2], ...literals.filter((l) => l !== quoted[2])];
		const q = options.some((o) => o.includes("'")) ? '\\\\"' : "'";
		return `${q}\${1|${options.map(escapeChoice).join(',')}|}${q}`;
	}
	if (/^boolean$/.test(p.type) && /^(true|false)$/.test(p.value)) {
		const other = p.value === 'true' ? 'false' : 'true';
		return `\${1|${p.value},${other}|}`;
	}
	if (quoted) {
		const q = jsQuote(quoted[2]);
		return `${q}\${1:${escapePlaceholder(quoted[2])}}${q}`;
	}
	return `\${1:${escapePlaceholder(p.value)}}`;
}

/** Object-literal key: `name: <default>`. */
export function propertySnippet(p: PropertyDefault): string {
	return `${p.name}: ${valueSnippet(p)}`;
}

/** Assignment statement: `name = <default>;` (without `;` when one follows). */
export function assignmentSnippet(
	p: PropertyDefault,
	semicolon = true,
): string {
	return `${p.name} = ${valueSnippet(p)}${semicolon ? ';' : ''}`;
}

/**
 * Where a property completion lands:
 * - `key`    – object-literal key: the word is preceded by `{` or `,`
 *              (`SEQdot.settings = { minGr|`);
 * - `assign` – last link of a member chain that starts a statement
 *              (`SEQdot.settings.minGr|` at the start of the block, after
 *              `;` / `{` / `}`, or on a new line that does not continue an
 *              expression);
 * - `undefined` – anywhere else, e.g. `if (SEQdot.settings.minGr|`.
 *
 * `textBefore` is the embedded block's text left of the cursor, `suffix` the
 * rest of the line right of it. Already followed by `:` / `=` / `(` → no
 * snippet.
 */
export function propertySlot(
	textBefore: string,
	suffix: string,
): 'key' | 'assign' | undefined {
	const rest = textBefore.replace(/[\w$]*$/, '');
	const trimmed = rest.trimEnd();
	if (trimmed.endsWith('{') || trimmed.endsWith(',')) {
		return /^[\w$]*\s*:/.test(suffix) ? undefined : 'key';
	}
	const chain = /[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\.\s*$/.exec(
		rest,
	);
	if (!chain || /^[\w$]*\s*(?:[=(.]|\?\.)/.test(suffix)) {
		return undefined;
	}
	const before = rest.slice(0, chain.index);
	if (/[\w$.]$/.test(before)) {
		return undefined; // the chain match started mid-identifier
	}
	const prev = before.trimEnd();
	if (prev === '' || /[;{}]$/.test(prev)) {
		return 'assign';
	}
	const newLine = /\n[ \t]*$/.test(before);
	return newLine && !/[([,=+\-*/%?:&|!<>~^]$/.test(prev)
		? 'assign'
		: undefined;
}
