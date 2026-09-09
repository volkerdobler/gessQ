import * as vscode from 'vscode';
import { GessQFormattingProvider } from '../providers/formattingProvider';

let docCounter = 0;

function makeDoc(lines: string[]): vscode.TextDocument {
	const id = ++docCounter;
	const text = lines.join('\n');
	return {
		uri: { toString: () => `test://fmt-${id}.q`, path: `/fmt-${id}.q` },
		languageId: 'gessq',
		version: 1,
		lineCount: lines.length,
		getText: () => text,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

const OPTS: vscode.FormattingOptions = { tabSize: 2, insertSpaces: true };

/** Apply the edits to `lines` so tests can assert on the resulting text. */
function apply(lines: string[], edits: vscode.TextEdit[]): string[] {
	const out = [...lines];
	// Edits never span multiple lines here, so per-line replacement is safe.
	for (const e of edits) {
		const line = e.range.start.line;
		const from = e.range.start.character;
		const to = e.range.end.character;
		out[line] = out[line].slice(0, from) + e.newText + out[line].slice(to);
	}
	return out;
}

describe('GessQFormattingProvider', () => {
	const provider = new GessQFormattingProvider();

	test('reindents by {/( nesting depth (regression)', () => {
		const lines = [
			'singleq q1;',
			'initActionBlock = {',
			'x = 1;',
			'};',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual([
			'singleq q1;',
			'initActionBlock = {',
			'  x = 1;',
			'};',
		]);
	});

	test('labels= list body (incl. group(…)) keeps its hand-alignment', () => {
		const lines = [
			'singleq q1;',
			'labels =',
			'1   "Audi"',
			'      2  "BMW"',
			'group(',
			'10 "X"',
			')',
			';',
			'title = "T";',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual(lines);
	});

	test('the labels= opener line itself still gets normal indentation', () => {
		const lines = [
			'initActionBlock = {',
			'singleq q1;',
			'labels =',
			'1 "a"',
			';',
			'};',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual([
			'initActionBlock = {',
			'  singleq q1;',
			'  labels =',
			'1 "a"', // untouched: inside the list body
			';', // untouched: still the list's closing line
			'};',
		]);
	});

	test('depth after the list is correct again once it closes', () => {
		const lines = [
			'initActionBlock = {',
			'singleq q1;',
			'labels = 1 "a" 2 "b";',
			'title = "T";',
			'};',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual([
			'initActionBlock = {',
			'  singleq q1;',
			'  labels = 1 "a" 2 "b";',
			'  title = "T";',
			'};',
		]);
	});

	test('trims trailing whitespace inside a protected labels= list', () => {
		// The opener line itself is a normal (non-protected) line and, like
		// every non-protected line, only ever gets its *leading* whitespace
		// touched – so its own trailing whitespace is left alone here.
		const lines = [
			'singleq q1;',
			'labels =',
			'1 "a"   ',
			';',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual([
			'singleq q1;',
			'labels =',
			'1 "a"',
			';',
		]);
	});

	test('labels = copy X; (single line) is not treated as a multi-line list', () => {
		const lines = [
			'initActionBlock = {',
			'singleq q2;',
			'labels = copy q1;',
			'title = "T";',
			'};',
		];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentFormattingEdits(doc, OPTS);
		expect(apply(lines, edits)).toEqual([
			'initActionBlock = {',
			'  singleq q2;',
			'  labels = copy q1;',
			'  title = "T";',
			'};',
		]);
	});

	test('range formatting only edits lines within the given range', () => {
		const lines = ['initActionBlock = {', 'x = 1;', 'y = 2;', '};'];
		const doc = makeDoc(lines);
		const edits = provider.provideDocumentRangeFormattingEdits(
			doc,
			new vscode.Range(1, 0, 1, lines[1].length),
			OPTS,
		);
		expect(apply(lines, edits)).toEqual([
			'initActionBlock = {',
			'  x = 1;',
			'y = 2;', // outside the requested range: untouched
			'};',
		]);
	});
});
