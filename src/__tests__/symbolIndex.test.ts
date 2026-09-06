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

test('extracts quotagroup definitions (begin form and inline form)', () => {
	const syms = parseDocumentSymbols(
		makeDoc([
			'quotagroup qgRegion begin;',
			'quotavar qNord = ( 1 );',
			'quotagroup end;',
			'quotagroup qgAge = ( qNord );',
		]),
	);
	const byName = Object.fromEntries(syms.map((s) => [s.name, s]));
	expect(byName['qgRegion'].category).toBe('quota');
	expect(byName['qgRegion'].detail).toBe('quotagroup');
	expect(byName['qgAge'].detail).toBe('quotagroup');
	expect(byName['end']).toBeUndefined();
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

describe('answer-code (labels=) extraction', () => {
	test('attaches codes + texts to a question, ignoring text-labels', () => {
		const [q] = parseDocumentSymbols(
			makeDoc([
				'singleq s7;',
				'text = "Welche Marke?";',
				'labels =',
				'text "Deutsche"',
				'1 "Audi" random',
				'2 "BMW" random',
				'99 "keine" single',
				';',
				'',
				'singleq next;',
			]),
		);
		expect(q.name).toBe('s7');
		expect(q.labels).toEqual([
			{ code: '1', text: 'Audi' },
			{ code: '2', text: 'BMW' },
			{ code: '99', text: 'keine' },
		]);
	});

	test('stops at the terminating `;` – later numbers are not codes', () => {
		const [q] = parseDocumentSymbols(
			makeDoc([
				'singleq s1;',
				'labels = 1 "a" 2 "b";',
				'assert ( count(s1) eq 1 ) "3 pick one" exit 2;',
			]),
		);
		expect(q.labels).toEqual([
			{ code: '1', text: 'a' },
			{ code: '2', text: 'b' },
		]);
	});

	test('gridlabels are indexed too; restrict() codes are not', () => {
		const [q] = parseDocumentSymbols(
			makeDoc([
				'singlegridq g;',
				'gridlabels=',
				'1 "(1) top" restrict([1:3])',
				'2 "(2)"',
				';',
			]),
		);
		expect(q.labels).toEqual([
			{ code: '1', text: '(1) top' },
			{ code: '2', text: '(2)' },
		]);
	});

	test('`labels copy X` inherits X’s codes (same file)', () => {
		const syms = parseDocumentSymbols(
			makeDoc([
				'multiq bekannt;',
				'labels = 1 "P1" 2 "P2" 3 "P3";',
				'multiq gekauft;',
				'labels copy bekannt;',
				'restrict = bekannt;',
			]),
		);
		const byName = Object.fromEntries(syms.map((s) => [s.name, s]));
		expect(byName['gekauft'].labels).toEqual(byName['bekannt'].labels);
		expect(byName['gekauft'].labels).toHaveLength(3);
	});

	test('a question without a labels list has no `labels`', () => {
		const [q] = parseDocumentSymbols(
			makeDoc(['openq o1;', 'text = "frei";']),
		);
		expect(q.labels).toBeUndefined();
	});

	test('a label list inside a comment is ignored', () => {
		const [q] = parseDocumentSymbols(
			makeDoc([
				'singleq s1;',
				'// labels = 1 "ghost";',
				'labels = 5 "real";',
			]),
		);
		expect(q.labels).toEqual([{ code: '5', text: 'real' }]);
	});
});
