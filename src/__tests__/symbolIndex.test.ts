import { parseDocumentSymbols } from '../core/symbolIndex';
import * as vscode from 'vscode';

let docCounter = 0;

function makeDoc(lines: string[]): vscode.TextDocument {
	const id = ++docCounter;
	return {
		uri: { toString: () => `test://doc-${id}.q` },
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

test('extracts question / definition / block / macro / action symbols', () => {
	const syms = parseDocumentSymbols(
		makeDoc([
			'singleq Frage1;',
			'opennumformat onf_X = 1 2 0 2 0 100 0 "e";',
			'block myBlock = ( Frage1 );',
			'#macro labellist',
			'set( qTarget = 1 );',
		]),
	);

	const byName = Object.fromEntries(syms.map((s) => [s.name, s]));
	expect(byName['Frage1'].category).toBe('question');
	expect(byName['Frage1'].detail).toBe('singleq');
	expect(byName['onf_X'].category).toBe('definition');
	expect(byName['myBlock'].category).toBe('block');
	expect(byName['labellist'].category).toBe('macro');
	expect(byName['qTarget'].category).toBe('action');
});

test('extracts array / vararray definitions', () => {
	const syms = parseDocumentSymbols(
		makeDoc(['array grp [3];', 'vararray members = ( a b c );']),
	);
	const byName = Object.fromEntries(syms.map((s) => [s.name, s]));
	expect(byName['grp'].category).toBe('array');
	expect(byName['grp'].detail).toBe('array');
	expect(byName['members'].category).toBe('array');
	expect(byName['members'].detail).toBe('vararray');
});

test('extracts compute / textarray / textelement / intrandom / databaseConnection definitions', () => {
	const syms = parseDocumentSymbols(
		makeDoc([
			'compute alter = 2026 - gebjahr;',
			'textarray tx = { "a" "b" };',
			'textelement te = "hi";',
			'IntRandom rnd = 1 6;',
			'databaseConnection dbMail = ( "m", "t", ( a ) );',
		]),
	);
	const byName = Object.fromEntries(syms.map((s) => [s.name, s]));
	expect(byName['alter'].category).toBe('definition');
	expect(byName['alter'].detail).toBe('compute');
	expect(byName['tx'].category).toBe('array');
	expect(byName['tx'].detail).toBe('textarray');
	expect(byName['te'].category).toBe('definition');
	expect(byName['te'].detail).toBe('textelement');
	expect(byName['rnd'].category).toBe('definition');
	expect(byName['rnd'].detail).toBe('intrandom');
	expect(byName['dbMail'].category).toBe('definition');
	expect(byName['dbMail'].detail).toBe('databaseconnection');
});

test('extracts quotavar definitions', () => {
	const [sym] = parseDocumentSymbols(
		makeDoc(['quotavar qAge = ( age ge 18 );']),
	);
	expect(sym.name).toBe('qAge');
	expect(sym.category).toBe('quota');
	expect(sym.detail).toBe('quotavar');
});

test('name range points at the name token, not the keyword', () => {
	const [sym] = parseDocumentSymbols(makeDoc(['singleq   Frage1;']));
	expect(sym.nameRange.start.character).toBe('singleq   '.length);
	expect(sym.nameRange.end.character).toBe('singleq   Frage1'.length);
});

test('ignores definitions inside comments', () => {
	const syms = parseDocumentSymbols(
		makeDoc(['// singleq Ghost;', 'singleq Real;']),
	);
	expect(syms.map((s) => s.name)).toEqual(['Real']);
});

test('strips quotes from quoted names', () => {
	const [sym] = parseDocumentSymbols(makeDoc(['singleq "Frage1";']));
	expect(sym.name).toBe('Frage1');
});

test('a quoted name with an illegal character is not a definition', () => {
	// space / umlaut inside the quotes -> not a valid identifier
	expect(parseDocumentSymbols(makeDoc(['singleq "Frage 1";']))).toEqual([]);
	expect(parseDocumentSymbols(makeDoc(['singleq "Fräge";']))).toEqual([]);
});
