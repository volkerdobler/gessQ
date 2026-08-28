import { lintDocument } from '../core/diagnostics';
import * as vscode from 'vscode';

let n = 0;
function makeDoc(src: string): vscode.TextDocument {
	const lines = src.split('\n');
	return {
		uri: vscode.Uri.file(`/ws/d-${++n}.q`),
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

const messages = (src: string) =>
	lintDocument(makeDoc(src)).map((d) => d.message);

test('clean script produces no diagnostics', () => {
	expect(
		messages('singleq q1;\nif ( true ) {\n  set( x = 1 );\n};\n'),
	).toEqual([]);
});

test('flags an unclosed "{"', () => {
	expect(messages('if ( a ) {\n  x\n')).toContain('Unclosed "{"');
});

test('flags an unmatched ")"', () => {
	expect(messages('compute x = (a));\n')).toContain('Unmatched ")"');
});

test('brackets inside strings and comments are ignored', () => {
	expect(messages('text = "an ( unclosed paren"; // and } here\n')).toEqual(
		[],
	);
});

test('flags #macro without #endmacro', () => {
	expect(messages('#macro foo\nlabels=\n1 "a"\n;')).toContain(
		'#macro without a matching #endmacro',
	);
});

test('flags #endif without #ifdef', () => {
	expect(messages('#endif\n')).toContain('#endif without a matching #ifdef');
});

test('balanced #ifdef/#else/#endif is fine', () => {
	expect(messages('#ifdef A\nx\n#else\ny\n#endif\n')).toEqual([]);
});

test('flags a duplicate question definition', () => {
	const msgs = messages('singleq q1;\nmultiq q1;\n');
	expect(msgs.some((m) => m.includes('Duplicate'))).toBe(true);
});
