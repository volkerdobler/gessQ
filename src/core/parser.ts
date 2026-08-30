'use strict';

/**
 * Regex factories shared across the extension.
 *
 * Every factory takes an optional `word`:
 * - empty  → a generic pattern that matches any name (capturing it);
 * - given  → a pattern anchored to that exact name (bare or quoted).
 *
 * The empty-`word` result is memoised because it is the hot path (built once
 * per file per provider run). None of the patterns use the `g`/`y` flag, so a
 * shared `RegExp` is safe to reuse with `test`/`match`/`search`.
 */

// Allowed names: `[A-Za-z0-9_]`, and the first character is either a letter or
// `_`. The two starting rules differ by *context*:
//   - definitions   → letter only. The programmer must not (re)define a name
//                     that starts with `_`; that namespace is reserved.
//   - references    → letter or `_`, so the built-in system variables
//                     (`_finished`, `_caseid`, `_currentdate`, … – see
//                     language/gessq.tmLanguage.json) are still navigable
//                     ("Find References", highlight, hover).
const constTokenDefNameStart = '(?:[A-Za-z])';
const constTokenRefNameStart = '(?:[A-Za-z_])';
const constTokenVarNameRest = '(?:[A-Za-z0-9_]*)';

/** Bare name grammars, no anchors. */
const constTokenDefName = constTokenDefNameStart + constTokenVarNameRest;
const constTokenRefName = constTokenRefNameStart + constTokenVarNameRest;

/**
 * A name as it may be *written* at a site: bare, or wrapped in single / double
 * quotes. The quotes are cosmetic - the *content* still has to obey the
 * identifier grammar, so `"Frage 1"` (space) or `"Fräge"` (umlaut) are **not**
 * names. `symbolIndex.unquote` strips the quotes again.
 */
const quotedOrBare = (name: string): string =>
	'(?:(?:\\b' + name + '\\b)|(?:"' + name + '")|(?:\'' + name + "'))";

/** Generic capturing fragment for a *definition* name (no leading `_`). */
const constVarName: string = quotedOrBare(constTokenDefName);
/** Generic capturing fragment for a *reference* name (leading `_` allowed). */
const constRefVarName: string = quotedOrBare(constTokenRefName);

/** Token suffix used by workspace symbol queries. */
export const constTokenVarNameRestExport = constTokenVarNameRest;

/** A valid name at a definition site: letter, then `[A-Za-z0-9_]`. */
const validDefName = /^[A-Za-z][A-Za-z0-9_]*$/;
/** A valid name at a reference site: letter or `_`, then `[A-Za-z0-9_]`. */
const validRefName = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Escape regex metacharacters so `s` is matched literally. */
export const escapeRe = (s: string): string =>
	s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A regex fragment that can never match anything. */
const neverMatch = '(?!x)x';

/**
 * Fragment matching `word` bare or quoted, gated by `valid`. When `word` fails
 * the grammar we return a fragment that never matches instead of splicing an
 * arbitrary string into a `RegExp` (which would silently turn `.`/`$` into
 * metacharacters or throw). The `escapeRe` call is a belt-and-braces guard for
 * the valid case.
 */
function wordFragment(word: string, valid: RegExp): string {
	if (!valid.test(word)) {
		return neverMatch;
	}
	const w = escapeRe(word);
	return '(?:(?:\\b' + w + '\\b)|(?:"' + w + '")|(?:\'' + w + "'))";
}

/**
 * Match `word` at a *reference* site, bare or quoted (single/double). Accepts
 * the built-in system variables (leading `_`).
 */
export function getWordDefinition(word: string): string {
	return wordFragment(word, validRefName);
}

/**
 * Match `word` at a *definition* site. Like {@link getWordDefinition} but
 * rejects a leading `_`: the programmer may reference the built-in `_…`
 * variables but never (re)define them.
 */
export function getWordDefinitionStrict(word: string): string {
	return wordFragment(word, validDefName);
}

/** Wrap a factory so the generic (empty-`word`) result is built only once. */
function memoizeEmpty(fn: (word: string) => RegExp): (word?: string) => RegExp {
	let cached: RegExp | undefined;
	return (word?: string) => {
		if (word && word.length > 0) {
			return fn(word);
		}
		return (cached ??= fn(''));
	};
}

/** Name fragment for a *reference* factory (leading `_` allowed). */
const refNameFrag = (word: string) =>
	word && word.length > 0 ? getWordDefinition(word) : constRefVarName;

/** Name fragment for a *definition* factory (no leading `_`). */
const defNameFrag = (word: string) =>
	word && word.length > 0 ? getWordDefinitionStrict(word) : constVarName;

/** Question definitions: `singleq NAME`, `multiq "NAME"`, … (g1 type, g2 name). */
export const questionDefRe = memoizeEmpty((word) => {
	const types =
		'(singleq|multiq|singlegridq|multigridq|openq|textq|numq|gnumq|passwdq|uploadq|group)';
	return new RegExp(
		word && word.length > 0
			? '\\b' + types + '\\b\\s*' + getWordDefinitionStrict(word)
			: '\\b' + types + '\\b\\s+(' + constVarName + ')',
		'i',
	);
});

/** `opennumformat NAME` definitions (g1 keyword, g2 name). */
export const definitionDefRe = memoizeEmpty((word) => {
	const kw = '(opennumformat)';
	return new RegExp(
		word && word.length > 0
			? '\\b' + kw + '\\b\\s*' + getWordDefinitionStrict(word)
			: '\\b' + kw + '\\b\\s+(' + constVarName + ')',
		'i',
	);
});

/**
 * `array NAME [ … ]` / `array NAME = …` / `vararray NAME = ( … )` definitions
 * (g1 keyword, g2 name).
 *
 * All three forms introduce a new variable, so the name is treated as a
 * definition target for "Go to Definition" – on par with a question of the
 * same name (e.g. `array group [3];` beside `group …`).
 */
export const arrayDefRe = memoizeEmpty((word) => {
	return new RegExp(
		'\\b(array|vararray)\\b\\s+(' + defNameFrag(word) + ')\\s*(?=[[=;]|$)',
		'i',
	);
});

/**
 * `quotavar NAME = ( <condition> );` definitions (g1 keyword, g2 name).
 *
 * Defines the quota variable NAME, so the name is a "Go to Definition" /
 * "Find All References" target. `\b` keeps `prequotavar` (a script
 * parameter) from matching.
 */
export const quotavarDefRe = memoizeEmpty((word) => {
	return new RegExp(
		'\\b(quotavar)\\b\\s+(' + defNameFrag(word) + ')\\s*=',
		'i',
	);
});

/** `block NAME =` / `screen NAME =` definitions (g1 keyword, g2 name). */
export const blockDefRe = memoizeEmpty((word) => {
	return new RegExp(
		'\\b(block|screen)\\b\\s*(' + defNameFrag(word) + ')\\b\\s*=',
		'i',
	);
});

/** Uses of a block/screen inside another block or screen definition. */
export const blockRe = memoizeEmpty((word) => {
	const name = refNameFrag(word);
	return new RegExp(
		'\\b(?:(?:block|screen)\\b.*' +
			name +
			'\\b\\s*=)' +
			'|(?:block\\b[^=]*=\\s*\\(.*\\b' +
			name +
			'\\b)' +
			'|(?:screen\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b' +
			name +
			'\\b)',
		'i',
	);
});

/** `check` expressions referencing a variable/literal. */
export const checkRe = memoizeEmpty((word) => {
	const v = refNameFrag(word);
	return new RegExp(
		'(?:in\\s*\\b' +
			v +
			'\\b)|(?:\\b' +
			v +
			'\\b\\s*(?:eq|ne|le|ge|lt|gt))\\b',
		'i',
	);
});

/** `assert ( … NAME … )` expressions. */
export const assertRe = memoizeEmpty(
	(word) =>
		new RegExp('\\bassert\\s+\\(.*\\b' + refNameFrag(word) + '\\b', 'i'),
);

/** `compute … NAME …` expressions. */
export const computeRe = memoizeEmpty(
	(word) =>
		new RegExp('\\bcompute\\b\\s*.+\\b' + refNameFrag(word) + '\\b', 'i'),
);

/** `load( NAME =` / `set( NAME =` – definition side (no capture of the name). */
export const actionBlockDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(load|set)\\b\\s*\\(\\s*(?:' + defNameFrag(word) + '\\s*=)',
			'i',
		),
);

/** `load( NAME =` / `set( NAME =` – target definition (g1 keyword, g2 name). */
export const actionDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(load|set)\\b\\s*\\(\\s*(' + defNameFrag(word) + ')\\s*=',
			'i',
		),
);

/** `load( NAME =` / `set( NAME =` – usage side (g1 keyword, g2 name). */
export const actionBlockRe = memoizeEmpty((word) => {
	const v =
		word && word.length > 0
			? getWordDefinition(word)
			: constRefVarName + '|(?:[^=]+)';
	return new RegExp('\\b(load|set)\\s*\\(\\s*(?:(' + v + ')\\s*=)', 'i');
});

/**
 * `#macro NAME` definitions (g1 `macro`, g2 name).
 *
 * The name is *not* prefixed with `#` (see handbook §2.4). A negative
 * look-behind keeps `x#macro` from matching while `#macro` / ` #macro` do.
 */
export const macroDefRe = memoizeEmpty(
	(word) =>
		new RegExp('(?<!\\w)#(macro)\\b\\s+(' + defNameFrag(word) + ')', 'i'),
);

/**
 * `compute NAME = …` definitions (g1 keyword, g2 name).
 *
 * `compute` introduces a new calculated variable, so `NAME` is a
 * "Go to Definition" / "Find All References" target – like a question of the
 * same name. (`computeRe` above is the complementary *usage* pattern.)
 */
export const computeDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(compute)\\b\\s+(' + defNameFrag(word) + ')\\s*=',
			'i',
		),
);

/**
 * `textarray NAME = { … }` / `textarray NAME = FRAGE;` definitions
 * (g1 keyword, g2 name).
 */
export const textArrayDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(textarray)\\b\\s+(' + defNameFrag(word) + ')\\s*=',
			'i',
		),
);

/** `textelement NAME [= "…"] [saved;]` definitions (g1 keyword, g2 name). */
export const textElementDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(textelement)\\b\\s+(' + defNameFrag(word) + ')\\b',
			'i',
		),
);

/** `intrandom NAME = VON BIS;` definitions (g1 keyword, g2 name). */
export const intRandomDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(intrandom)\\b\\s+(' + defNameFrag(word) + ')\\s*=',
			'i',
		),
);

export { constTokenVarNameRestExport as constTokenVarNameRest };
