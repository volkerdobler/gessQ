import { expandMacroNames, parseMacroCalls } from '../core/macroExpansion';
import { parseDocumentSymbols } from '../core/symbolIndex';
import * as vscode from 'vscode';

let n = 0;
function makeDoc(src: string): vscode.TextDocument {
	const lines = src.split('\n');
	return {
		uri: { toString: () => `test://macro-${++n}.q` },
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

const calls = (src: string) =>
	parseMacroCalls(makeDoc(src)).map((c) => [
		c.macro,
		Object.fromEntries(c.params),
	]);

describe('parseMacroCalls', () => {
	test('bare and quoted parameters', () => {
		expect(
			calls('&mcrF1;$z=2\n&so;$name="Frage";$label=\'Code\';\n'),
		).toEqual([
			['mcrF1', { z: '2' }],
			['so', { name: 'Frage', label: 'Code' }],
		]);
	});

	test('calls without parameters and in comments are skipped', () => {
		expect(calls('&m;\n// &m;$z=1\nif ( a &&b; ) {};\n')).toEqual([]);
	});
});

describe('macro templates', () => {
	const src =
		'#macro mcrF1\nsingleq f1_$z;\ntext="";\nblock bl_$z = ( f1_$z );\n#endmacro\nsingleq q2;\n';

	test('are attached to the macro, not indexed as names', () => {
		const syms = parseDocumentSymbols(makeDoc(src));
		expect(syms.map((s) => s.name)).toEqual(['mcrF1', 'q2']);
		expect(syms[0].templates).toEqual(['f1_$z', 'bl_$z']);
	});

	test('expand per call', () => {
		const doc = makeDoc(src + '&mcrF1;$z=2\n&other;$z=3\n');
		const macros = parseDocumentSymbols(doc);
		expect([...expandMacroNames(macros, parseMacroCalls(doc))]).toEqual([
			'f1_2',
			'bl_2',
		]);
	});

	test('longest parameter wins, unset parameters are skipped', () => {
		const macros = [{ name: 'm', templates: ['q$zz_$z', 'r$y'] }];
		const c = [
			{
				macro: 'm',
				params: new Map([
					['z', '1'],
					['zz', '9'],
				]),
			},
		];
		expect([...expandMacroNames(macros, c)]).toEqual(['q9_1']);
	});
});
