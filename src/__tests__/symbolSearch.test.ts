import * as vscode from 'vscode';
import { findReferences, insertRefColumns } from '../core/symbolSearch';

let n = 0;
function makeDoc(src: string): vscode.TextDocument {
	const lines = src.split('\n');
	return {
		uri: vscode.Uri.file(`/ws/s-${++n}.q`),
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

/** `findReferences` over one document, as `line:column` strings. */
async function refs(src: string, word: string): Promise<string[]> {
	const doc = makeDoc(src);
	jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
		doc as never,
	);
	const locs = await findReferences([doc.uri], word);
	return locs.map((l) => `${l.range.start.line}:${l.range.start.character}`);
}

afterEach(() => jest.restoreAllMocks());

describe('insertRefColumns', () => {
	test('all three bracket forms', () => {
		expect(insertRefColumns('@insert(q1)', 'q1')).toEqual([8]);
		expect(insertRefColumns('@insert[q1]', 'q1')).toEqual([8]);
		expect(insertRefColumns('@insert{q1}', 'q1')).toEqual([8]);
	});

	test('whitespace, keyword case and several inserts per line', () => {
		expect(insertRefColumns('@INSERT ( q1 )', 'q1')).toEqual([10]);
		expect(insertRefColumns('a @insert(q1) b @insert(q1)', 'q1')).toEqual([
			10, 24,
		]);
	});

	test('whole word only', () => {
		expect(insertRefColumns('@insert(q10)', 'q1')).toEqual([]);
		expect(insertRefColumns('@insert(xq1)', 'q1')).toEqual([]);
		expect(insertRefColumns('@insert(q1.3)', 'q1')).toEqual([8]);
	});

	test('variable names are case-sensitive', () => {
		expect(insertRefColumns('@insert(Q1)', 'q1')).toEqual([]);
		expect(insertRefColumns('@insert(Var) @insert(VAR)', 'VAR')).toEqual([
			21,
		]);
	});
});

describe('findReferences is case-sensitive', () => {
	test('VAR, Var and var are different variables', async () => {
		const src = [
			'singleq VAR;',
			'singleq Var;',
			'compute x = var + VAR;',
			'text="@insert(Var) @insert(VAR)";',
		].join('\n');
		expect(await refs(src, 'VAR')).toEqual(['0:8', '2:18', '3:27']);
		expect(await refs(src, 'Var')).toEqual(['1:8', '3:14']);
	});
});

describe('findReferences with @insert', () => {
	test('counts the @insert argument inside question text', async () => {
		expect(
			await refs(
				'singleq geschlecht;\ntextq t;\ntext="Sie sind @insert(geschlecht).";',
				'geschlecht',
			),
		).toEqual(['0:8', '2:23']);
	});

	test('only the argument, not the same word as prose', async () => {
		expect(await refs('text="Alter: @insert(alter)";', 'alter')).toEqual([
			'0:21',
		]);
	});

	test('ignores @insert inside comments', async () => {
		expect(await refs('// @insert(q1)', 'q1')).toEqual([]);
	});

	test('no duplicate when the line already is a reference line', async () => {
		expect(await refs('singleq q1 "Vorher: @insert(q1)";', 'q1')).toEqual([
			'0:8',
			'0:28',
		]);
	});
});
