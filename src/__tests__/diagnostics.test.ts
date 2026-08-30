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

test('"rendering = thymeleaf;" at the top is fine', () => {
	expect(messages('rendering = thymeleaf;\nsingleq q1;\n')).toEqual([]);
});

test('flags a second "rendering ="', () => {
	const msgs = messages('rendering = thymeleaf;\nrendering = html;\n');
	expect(msgs).toContain(
		'"rendering" should be set only once (it is global).',
	);
});

test('flags "rendering =" after the first question', () => {
	const msgs = messages('singleq q1;\nrendering = thymeleaf;\n');
	expect(msgs).toContain(
		'"rendering" must be set before the first question definition.',
	);
});

test('"renderClass" at a question is not mistaken for "rendering"', () => {
	expect(messages('singleq q1;\nrenderClass = "version1";\n')).toEqual([]);
});

const hasDuplicate = (src: string) =>
	messages(src).some((m) => m.includes('Duplicate'));

describe('duplicate definitions across #ifdef branches', () => {
	test('plain top-level duplicate is still flagged', () => {
		expect(hasDuplicate('block b = ( q );\nblock b = ( q );\n')).toBe(true);
	});

	test('mutually exclusive #ifdef X / #ifndef X branches → no error', () => {
		expect(
			hasDuplicate(
				'#ifdef X\n#ifdef Y\nblock b = ( q );\n#endif\n#endif\n' +
					'#ifndef X\nblock b = ( q );\n#endif\n',
			),
		).toBe(false);
	});

	test('same #ifdef X twice → error', () => {
		expect(
			hasDuplicate(
				'#ifdef X\nblock b = ( q );\n#endif\n' +
					'#ifdef X\nblock b = ( q );\n#endif\n',
			),
		).toBe(true);
	});

	test('nested {X,Y} vs {X} still shares X → error', () => {
		expect(
			hasDuplicate(
				'#ifdef X\n#ifdef Y\nblock b = ( q );\n#endif\n#endif\n' +
					'#ifdef X\nblock b = ( q );\n#endif\n',
			),
		).toBe(true);
	});

	test('#ifdef X vs its own #else branch → no error', () => {
		expect(
			hasDuplicate(
				'#ifdef X\nblock b = ( q );\n#else\nblock b = ( q );\n#endif\n',
			),
		).toBe(false);
	});

	test('a #ifdef inside a comment does not guard anything', () => {
		expect(
			hasDuplicate(
				'// #ifdef X\nblock b = ( q );\n// #endif\nblock b = ( q );\n',
			),
		).toBe(true);
	});

	test('three definitions: X, !X, X → only the third is flagged', () => {
		const msgs = messages(
			'#ifdef X\nblock b = ( q );\n#endif\n' +
				'#ifndef X\nblock b = ( q );\n#endif\n' +
				'#ifdef X\nblock b = ( q );\n#endif\n',
		);
		expect(msgs.filter((m) => m.includes('Duplicate'))).toHaveLength(1);
	});
});
