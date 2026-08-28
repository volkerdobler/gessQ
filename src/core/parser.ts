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

const constTokenVarNameRest = '(?:[A-Za-zÄÖÜßäöü\\w\\$]*)';

const constTokenVarName =
	'(?:\\b(?:[A-Za-zÄÖÜßäöü])' + constTokenVarNameRest + '\\b)';

const constStringVarName = '(?:"[^"]+")|(?:\'[^\']+\')';

const constVarName: string =
	'(?:' + constTokenVarName + '|' + constStringVarName + ')';

/** Token suffix used by workspace symbol queries. */
export const constTokenVarNameRestExport = constTokenVarNameRest;

/** Match `word` bare or quoted (single/double). */
export function getWordDefinition(word: string): string {
	return '(?:(?:\\b' + word + '\\b)|(?:"' + word + '")|(?:\'' + word + "'))";
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

const nameFrag = (word: string) =>
	word && word.length > 0 ? getWordDefinition(word) : constVarName;

/** Question definitions: `singleq NAME`, `multiq "NAME"`, … (g1 type, g2 name). */
export const questionDefRe = memoizeEmpty((word) => {
	const types =
		'(singleq|multiq|singlegridq|multigridq|openq|textq|numq|gnumq|passwdq|uploadq|group)';
	return new RegExp(
		word && word.length > 0
			? '\\b' + types + '\\b\\s*' + getWordDefinition(word)
			: '\\b' + types + '\\b\\s+(' + constVarName + ')',
		'i',
	);
});

/** `opennumformat NAME` definitions (g1 keyword, g2 name). */
export const definitionDefRe = memoizeEmpty((word) => {
	const kw = '(opennumformat)';
	return new RegExp(
		word && word.length > 0
			? '\\b' + kw + '\\b\\s*' + getWordDefinition(word)
			: '\\b' + kw + '\\b\\s+(' + constVarName + ')',
		'i',
	);
});

/** `block NAME =` / `screen NAME =` definitions (g1 keyword, g2 name). */
export const blockDefRe = memoizeEmpty((word) => {
	return new RegExp(
		'\\b(block|screen)\\b\\s*(' + nameFrag(word) + ')\\b\\s*=',
		'i',
	);
});

/** Uses of a block/screen inside another block or screen definition. */
export const blockRe = memoizeEmpty((word) => {
	const name = nameFrag(word);
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
	const v = nameFrag(word);
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
	(word) => new RegExp('\\bassert\\s+\\(.*\\b' + nameFrag(word) + '\\b', 'i'),
);

/** `compute … NAME …` expressions. */
export const computeRe = memoizeEmpty(
	(word) =>
		new RegExp('\\bcompute\\b\\s*.+\\b' + nameFrag(word) + '\\b', 'i'),
);

/** `load( NAME =` / `set( NAME =` – definition side (no capture of the name). */
export const actionBlockDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(load|set)\\b\\s*\\(\\s*(?:' + nameFrag(word) + '\\s*=)',
			'i',
		),
);

/** `load( NAME =` / `set( NAME =` – target definition (g1 keyword, g2 name). */
export const actionDefRe = memoizeEmpty(
	(word) =>
		new RegExp(
			'\\b(load|set)\\b\\s*\\(\\s*(' + nameFrag(word) + ')\\s*=',
			'i',
		),
);

/** `load( NAME =` / `set( NAME =` – usage side (g1 keyword, g2 name). */
export const actionBlockRe = memoizeEmpty((word) => {
	const v =
		word && word.length > 0
			? getWordDefinition(word)
			: constVarName + '|(?:[^=]+)';
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
		new RegExp('(?<!\\w)#(macro)\\b\\s+(' + nameFrag(word) + ')', 'i'),
);

export { constTokenVarNameRestExport as constTokenVarNameRest };
