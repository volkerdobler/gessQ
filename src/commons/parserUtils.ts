'use strict';

/**
 * Parser / regex helper utilities shared across the extension.
 */

const constTokenVarNameRest = '(?:[A-Za-zÄÖÜßäöü\\w\\$]*)';

const constTokenVarName =
	'(?:\\b(?:[A-Za-zÄÖÜßäöü])' + constTokenVarNameRest + '\\b)';

const constStringVarName = '(?:"[^"]+")|(?:\'[^\']+\')';

const constVarName: string =
	'(?:' + constTokenVarName + '|' + constStringVarName + ')';

const constVarList: string =
	'(' + constVarName + '(?:\\s+(?:' + constVarName + '))*)';
const constVarToList: string =
	'(?:' + constVarList + '\\s*\\bto\\b\\s*' + constVarList + ')';

/**
 * Expose token suffix used by workspace symbol queries.
 */
export const constTokenVarNameRestExport = constTokenVarNameRest;

/**
 * Return an escaped or quoted word definition used in other regexes.
 * @param word literal word to match
 */
export function getWordDefinition(word: string): string {
	return '(?:(?:\\b' + word + '\\b)|(?:"' + word + '")|(?:\'' + word + "'))";
}

/**
 * Regex for question definitions. Matches question types and optional name.
 * @param word optional name to match exactly
 */
export function questionDefRe(word: string): RegExp {
	const questConst =
		'(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)';

	let retVal = '';
	if (word && word.length > 0) {
		retVal = '\\b' + questConst + '\\b\\s*' + getWordDefinition(word);
	} else {
		retVal = '\\b' + questConst + '\\b\\s(' + constVarName + ')';
	}
	return new RegExp(retVal, 'i');
}

/**
 * Regex for definition declarations (opennumformat).
 * @param word optional name to match exactly
 */
export function definitionDefRe(word: string): RegExp {
	const questConst = '(opennumformat)';

	let retVal = '';
	if (word && word.length > 0) {
		retVal = '\\b' + questConst + '\\b\\s*' + getWordDefinition(word);
	} else {
		retVal = '\\b' + questConst + '\\b\\s(' + constVarName + ')';
	}
	return new RegExp(retVal, 'i');
}

/**
 * Regex for block definitions (block/screen) with optional name.
 * @param word optional name to match exactly
 */
export function blockDefRe(word: string): RegExp {
	const blockConst = '(block|screen)';

	let retName = '';
	if (word && word.length > 0) {
		retName = getWordDefinition(word);
	} else {
		retName = constVarName;
	}
	return new RegExp(
		'\\b' + blockConst + '\\b\\s*(' + retName + ')\\b\\s*=',
		'i',
	);
}

/**
 * Regex for block usages.
 * @param word optional name to match exactly
 */
export function blockRe(word: string): RegExp {
	const blockConst = '(?:block)';
	const screenConst = '(?:screen)';

	let retVal = '';
	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp(
		'\\b' +
			'(?:(' +
			blockConst +
			'|' +
			screenConst +
			')\\b.*' +
			retVal +
			'\\b\\s*=)' +
			'|' +
			'(?:' +
			blockConst +
			'\\b[^=]*=\\s*\\(.*\\b' +
			retVal +
			'\\b)' +
			'|' +
			'(?:' +
			screenConst +
			'\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b' +
			retVal +
			'\\b)',
		'i',
	);
}

/**
 * Regex for check expressions referencing variables or literals.
 * @param word optional variable or literal to match
 */
export function checkRe(word: string): RegExp {
	let retVal = '';

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp(
		'(?:in\\s*\\b' +
			retVal +
			'\\b)|(?:\\b' +
			retVal +
			'\\b\\s*(?:eq|ne|le|ge|lt|gt))\\b',
		'i',
	);
}

/**
 * Regex for assert expressions referencing variables or literals.
 * @param word optional variable or literal to match
 */
export function assertRe(word: string): RegExp {
	let retVal: string;

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp('\\bassert\\s+\\(.*\\b' + retVal + '\\b', 'i');
}

/**
 * Regex for compute expressions referencing variables or literals.
 * @param word optional variable or literal to match
 */
export function computeRe(word: string): RegExp {
	let retVal: string;

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp('\\bcompute\\b\\s*.+\\b' + retVal + '\\b', 'i');
}

/**
 * Regex for action block definitions (load/set ...) matching optional target.
 * @param word optional target name to match exactly
 */
export function actionBlockDefRe(word: string): RegExp {
	let retVal: string;

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp(
		'\\b(load|set)\\b\\s*\\(?:\\s*(?:' + retVal + '\\s*=)',
		'i',
	);
}

/**
 * Regex for action block usages (load/set(...)).
 * @param word optional name to match exactly
 */
export function actionBlockRe(word: string): RegExp {
	let retVal: string;

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName + '|(?:[^=]+)';
	}

	return new RegExp('\\b(load|set)\\s*\\(\\s*(?:(' + retVal + ')\\s*=)', 'i');
}

/**
 * Regex for macro definitions (#macro ...).
 * @param word optional macro name to match exactly
 */
export function macroDefRe(word: string): RegExp {
	let retVal: string;

	if (word && word.length > 0) {
		retVal = getWordDefinition(word);
	} else {
		retVal = constVarName;
	}

	return new RegExp('\\b#(macro)\\b\\s*#' + retVal, 'i');
}

export { constTokenVarNameRestExport as constTokenVarNameRest };
