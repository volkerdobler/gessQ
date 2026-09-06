import * as vscode from 'vscode';
import {
	detectContext,
	labelReferenceQuestion,
	isInLabelList,
	GessQCompletionProvider,
} from '../providers/completionProvider';
import type { SymbolIndex } from '../core/symbolIndex';

const kind = (prefix: string) => detectContext(prefix).kind;

describe('detectContext', () => {
	test('bare text → default', () => {
		expect(kind('singleq Fra')).toBe('default');
		expect(kind('')).toBe('default');
		expect(kind('  ')).toBe('default');
	});

	test('after # → hash directive', () => {
		expect(kind('#')).toBe('hashDirective');
		expect(kind('#inc')).toBe('hashDirective');
		expect(kind('   #ifd')).toBe('hashDirective');
	});

	test('after @ → at directive', () => {
		expect(kind('@')).toBe('atDirective');
		expect(kind('@ins')).toBe('atDirective');
	});

	test('after & → macro reference', () => {
		expect(kind('&')).toBe('macroRef');
		expect(kind('&label')).toBe('macroRef');
		expect(kind('text="foo &lab')).toBe('macroRef');
	});

	test('after #domacro → macro reference', () => {
		expect(kind('#domacro ')).toBe('macroRef');
		expect(kind('#domacro my')).toBe('macroRef');
	});

	test('&& (logical and) is not a macro reference', () => {
		expect(kind('if (a && b')).toBe('default');
	});

	test('after "rendering =" → rendering value', () => {
		expect(kind('rendering = ')).toBe('renderingValue');
		expect(kind('rendering=thy')).toBe('renderingValue');
		expect(kind('  rendering  =  html')).toBe('renderingValue');
		expect(kind('rendering = "')).toBe('renderingValue');
		expect(kind('rendering')).toBe('default');
		expect(kind('rendering = thymeleaf;')).toBe('default');
	});

	test('QNAME. / QNAME eq … → labelRef', () => {
		expect(detectContext('flt ( s7 eq ')).toEqual({
			kind: 'labelRef',
			question: 's7',
		});
		expect(detectContext('assert ( marken.')).toEqual({
			kind: 'labelRef',
			question: 'marken',
		});
	});
});

describe('labelReferenceQuestion', () => {
	test('after a comparison operator', () => {
		expect(labelReferenceQuestion('  s7 eq ')).toBe('s7');
		expect(labelReferenceQuestion('flt (marken ne 1')).toBe('marken');
		expect(labelReferenceQuestion('( a ge [1')).toBe('a');
	});

	test('after member access', () => {
		expect(labelReferenceQuestion('x = s7.')).toBe('s7');
		expect(labelReferenceQuestion('s7.2')).toBe('s7');
	});

	test('not triggered elsewhere', () => {
		expect(labelReferenceQuestion('singleq s7')).toBeUndefined();
		expect(labelReferenceQuestion('count(s7) eq ')).toBeUndefined(); // s7) has a ')'
		expect(labelReferenceQuestion('if (a && b')).toBeUndefined();
	});
});

let docCounter = 0;
function makeDoc(lines: string[]): vscode.TextDocument {
	const id = ++docCounter;
	const text = lines.join('\n');
	return {
		uri: { toString: () => `test://c-${id}.q`, path: `/c-${id}.q` },
		languageId: 'gessq',
		version: 1,
		lineCount: lines.length,
		getText: () => text,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
		offsetAt: (p: vscode.Position) => {
			let off = 0;
			for (let k = 0; k < p.line; k++) {
				off += lines[k].length + 1;
			}
			return off + p.character;
		},
	} as unknown as vscode.TextDocument;
}

describe('isInLabelList', () => {
	const doc = makeDoc([
		'singleq s1;',
		'text = "q";',
		'labels =',
		'1 "a" random',
		'2 "b"',
		';',
		'assert ( count(s1) eq 1 ) "" exit 2;',
	]);

	test('inside the list', () => {
		expect(isInLabelList(doc, new vscode.Position(3, 6))).toBe(true);
		expect(isInLabelList(doc, new vscode.Position(4, 5))).toBe(true);
	});

	test('outside – before the list and after its `;`', () => {
		expect(isInLabelList(doc, new vscode.Position(1, 4))).toBe(false);
		expect(isInLabelList(doc, new vscode.Position(6, 10))).toBe(false);
	});

	test('single-line list: inside before `;`, outside after', () => {
		const d = makeDoc(['singleq s;', 'labels = 1 "a" 2 "b";', 'export;']);
		expect(isInLabelList(d, new vscode.Position(1, 15))).toBe(true);
		expect(isInLabelList(d, new vscode.Position(1, 21))).toBe(false);
	});
});

function fakeIndex(defs: Record<string, unknown[]>): SymbolIndex {
	return {
		definitionsOf: (w: string) => defs[w.toLowerCase()] ?? [],
		match: () => [],
	} as unknown as SymbolIndex;
}

const extUri = { toString: () => 'x', path: '/x' } as vscode.Uri;
const labelText = (it: vscode.CompletionItem) =>
	typeof it.label === 'string' ? it.label : it.label.label;

describe('GessQCompletionProvider – label features', () => {
	test('labelRef → the question’s answer codes', () => {
		const doc = makeDoc([
			'singleq s7;',
			'labels = 1 "Audi" 2 "BMW" 10 "keine" single;',
			'singleq f;',
			'flt ( s7 eq ',
		]);
		const provider = new GessQCompletionProvider(fakeIndex({}), extUri);
		const items = provider.provideCompletionItems(
			doc,
			new vscode.Position(3, 12),
		);
		expect(items.map(labelText)).toEqual(['1', '2', '10']);
		expect(items[0].detail).toBe('Audi');
		// sortText keeps them in numeric order (so "10" sorts after "2")
		const sorts = items.map((i) => i.sortText as string);
		expect([...sorts].sort()).toEqual(sorts);
	});

	test('labelRef on an unknown question falls back to keywords', () => {
		const doc = makeDoc(['flt ( nope eq ']);
		const provider = new GessQCompletionProvider(fakeIndex({}), extUri);
		const items = provider.provideCompletionItems(
			doc,
			new vscode.Position(0, 14),
		);
		expect(items.map(labelText)).toContain('singleq');
	});

	test('inside labels= → label attributes, not question keywords', () => {
		const doc = makeDoc(['multiq m;', 'labels =', '1 "a" ', ';']);
		const provider = new GessQCompletionProvider(fakeIndex({}), extUri);
		const items = provider.provideCompletionItems(
			doc,
			new vscode.Position(2, 6),
		);
		const labels = items.map(labelText);
		expect(labels).toEqual(
			expect.arrayContaining(['random', 'single', 'flt']),
		);
		expect(labels).not.toContain('singleq');
	});
});
