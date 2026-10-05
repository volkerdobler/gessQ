import {
	lintDocument,
	lintUnknownNames,
	type KnownNames,
} from '../core/diagnostics';
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

describe('preprocessor directives must start in column 1', () => {
	const colMsg = (src: string) =>
		messages(src).filter((m) => m.includes('must start in column 1'));

	test('inline #ifdef / #endif in a labels list is flagged', () => {
		const msgs = colMsg(
			'labels = 1 "text" #ifdef client #endif 2 "text";\n',
		);
		expect(msgs).toHaveLength(2);
		expect(msgs[0]).toContain('"#ifdef"');
	});

	test('directive at the start of the line is fine', () => {
		expect(
			colMsg('labels =\n1 "text"\n#ifdef client\n2 "text"\n#endif\n;'),
		).toEqual([]);
	});

	test('leading whitespace before a directive is still fine', () => {
		expect(colMsg('\t#ifdef client\nx\n#endif\n')).toEqual([]);
	});

	test('a directive inside a comment or string is ignored', () => {
		expect(
			colMsg('x // see #ifdef client\ntext = "a #endif b";\n'),
		).toEqual([]);
	});

	test('@insert mid-line is flagged too', () => {
		expect(colMsg('foo @insert bar\n')).toHaveLength(1);
	});
});

test('flags a duplicate question definition', () => {
	const msgs = messages('singleq q1;\nmultiq q1;\n');
	expect(msgs.some((m) => m.includes('Duplicate'))).toBe(true);
});

test('q1 and Q1 are different questions, not duplicates', () => {
	const msgs = messages('singleq q1;\nmultiq Q1;\n');
	expect(msgs.some((m) => m.includes('Duplicate'))).toBe(false);
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

	// `#ifdef [X Y]` = X OR Y; stacked `#ifdef X` / `#ifdef Y` = X AND Y.
	test('#ifdef [X Y] vs #ifndef [X Y] are mutually exclusive → no error', () => {
		expect(
			hasDuplicate(
				'#ifdef [X Y]\nblock b = ( q );\n#endif\n' +
					'#ifndef [X Y]\nblock b = ( q );\n#endif\n',
			),
		).toBe(false);
	});

	test('#ifdef [X Y] vs #ifndef X only → error (Y could still make both fire)', () => {
		expect(
			hasDuplicate(
				'#ifdef [X Y]\nblock b = ( q );\n#endif\n' +
					'#ifndef X\nblock b = ( q );\n#endif\n',
			),
		).toBe(true);
	});

	test('#ifdef X AND #ifdef Y vs #ifndef [X Y] → error-free (X clashes)', () => {
		expect(
			hasDuplicate(
				'#ifdef X\n#ifdef Y\nblock b = ( q );\n#endif\n#endif\n' +
					'#ifndef [X Y]\nblock b = ( q );\n#endif\n',
			),
		).toBe(false);
	});

	test('#ifdef X vs #ifdef [X Y] → error (X defined lights up both)', () => {
		expect(
			hasDuplicate(
				'#ifdef X\nblock b = ( q );\n#endif\n' +
					'#ifdef [X Y]\nblock b = ( q );\n#endif\n',
			),
		).toBe(true);
	});

	test('#else of #ifdef [X Y] means neither X nor Y', () => {
		expect(
			hasDuplicate(
				'#ifdef [X Y]\nblock b = ( q );\n#else\nblock b = ( q );\n#endif\n' +
					'#ifdef X\nblock b = ( q );\n#endif\n',
			),
		).toBe(true); // 1st vs 3rd: [X∨Y] vs [X] – X lights both
	});
});

describe('missing "=" after an assignment keyword', () => {
	const eqMsg = (src: string) =>
		messages(src).filter((m) => m.startsWith('Missing "="'));

	test('labels without "=" (value on the next line) is flagged', () => {
		expect(eqMsg('singleq q1;\nlabels\n1 "Item"\n;\n')).toEqual([
			'Missing "=" after "labels"',
		]);
	});

	test('javascript directly followed by a string is flagged', () => {
		expect(eqMsg('javascript"\n\tSEQdot.\n";\n')).toEqual([
			'Missing "=" after "javascript"',
		]);
	});

	test('correct assignments are fine', () => {
		expect(
			eqMsg(
				'singleq q1;\ntext = "a";\nlabels=\n1 "Item"\n;\n' +
					'javascript = "x";\nHTML{ BackButton = yes; };\n',
			),
		).toEqual([]);
	});

	test('"export;" is fine, "export yes;" is flagged', () => {
		expect(eqMsg('singleq q1;\nexport;\n')).toEqual([]);
		expect(eqMsg('singleq q1;\nexport yes;\n')).toEqual([
			'Missing "=" after "export"',
		]);
	});

	test('label options and text labels mid-statement are fine', () => {
		expect(
			eqMsg(
				'multiq q1;\nlabels=\n1 "a" single\n2 "b" nomissing\n' +
					'3 "c" flt (x eq 1)\ntext "d" restrict(1)\n;\n',
			),
		).toEqual([]);
	});

	test('flt / restrict / ActionBlock with a missing "=" are flagged', () => {
		expect(
			eqMsg(
				'singleq q1;\nflt (x eq 1);\ninitActionBlock { set(x = 1); };\n',
			),
		).toEqual([
			'Missing "=" after "flt"',
			'Missing "=" after "initActionBlock"',
		]);
	});

	test('"labels copy FRAGE;" needs no "="', () => {
		expect(
			eqMsg('singleq q2;\nlabels copy q1;\ngridItems copy q1;\n'),
		).toEqual([]);
	});

	test('keywords in comments, strings and after a directive line', () => {
		expect(
			eqMsg('// labels 1 "a"\ntext = "labels 1";\n/* css "x" */\n'),
		).toEqual([]);
		expect(eqMsg('x = 1;\n#ifdef A\nlabels 1 "a";\n#endif\n')).toEqual([
			'Missing "=" after "labels"',
		]);
	});

	test('compute / block / screen: "=" is expected after the name', () => {
		expect(
			eqMsg('compute x = 1;\nblock b = ( q1 );\nscreen s = ( q1 );\n'),
		).toEqual([]);
		expect(
			eqMsg('compute x 1;\nblock b ( q1 );\nscreen s column( q1 );\n'),
		).toEqual([
			'Missing "=" after "compute x"',
			'Missing "=" after "block b"',
			'Missing "=" after "screen s"',
		]);
	});

	test('keyword as a question name is not mistaken for an assignment', () => {
		expect(eqMsg('singleq title;\nopenq css;\n')).toEqual([]);
	});
});

describe('unknown names in block / screen lists and @insert', () => {
	const unknown = (src: string, defined: string[]) => {
		const names = new Set(defined);
		const known: KnownNames = {
			has: (n) => names.has(n),
			caseVariant: (n) =>
				defined.find((d) => d.toLowerCase() === n.toLowerCase()),
		};
		return lintUnknownNames(makeDoc(src), known).map((d) => d.message);
	};

	test('flags a name that differs only in case, with a hint', () => {
		expect(
			unknown('singleq s1;\nblock bl_screener = ( S1 );\n', [
				's1',
				'bl_screener',
			]),
		).toEqual([
			'Unknown name "S1" – did you mean "s1"? Names are case-sensitive.',
		]);
	});

	test('flags an undefined name in a multi-line block', () => {
		expect(
			unknown('block main = (\n  q1\n  q2 // q3\n);\n', ['main', 'q1']),
		).toEqual(['Unknown name "q2"']);
	});

	test('screen lists: column/row/random/to are syntax, not names', () => {
		expect(
			unknown(
				'screen s = column( q1 row( q2 q3 ) random );\nscreen t = ( q1 to q3 );\n',
				['s', 't', 'q1', 'q2', 'q3'],
			),
		).toEqual([]);
		expect(
			unknown('screen s = column( q1 row( qx ) );\n', ['s', 'q1']),
		).toEqual(['Unknown name "qx"']);
	});

	test('only the list – block attributes after ";" are not checked', () => {
		expect(
			unknown('block nb = ( nb1 ); followup;\n', ['nb', 'nb1']),
		).toEqual([]);
	});

	test('@insert: unknown and case-mismatched names', () => {
		expect(
			unknown(
				'text = "Sie sind @insert(Geschlecht) / @insert(alter).";\n',
				['geschlecht', 'alter'],
			),
		).toEqual([
			'Unknown name "Geschlecht" – did you mean "geschlecht"? Names are case-sensitive.',
		]);
	});

	test('@insert: system variables, comments and other brackets', () => {
		expect(
			unknown(
				'title = "./media/@insert(_surveyname)/@insert[q1]";\n// @insert(nope)\n',
				['q1'],
			),
		).toEqual([]);
		expect(unknown('text = "@insert{nope}";\n', [])).toEqual([
			'Unknown name "nope"',
		]);
	});

	test('macro bodies and &param; names are skipped', () => {
		expect(
			unknown(
				'#macro m\nblock b_&n; = ( q&n; );\ntext = "@insert(q&n;)";\n#endmacro\nblock x = ( q_&n; );\n',
				['x'],
			),
		).toEqual([]);
	});
});
