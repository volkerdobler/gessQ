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
	const [sym] = parseDocumentSymbols(makeDoc(['singleq "Frage 1";']));
	expect(sym.name).toBe('Frage 1');
});
