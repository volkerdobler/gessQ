import * as vscode from 'vscode';
import { GessQFoldingRangeProvider } from '../providers/foldingRangeProvider';

function makeDoc(lines: string[]): vscode.TextDocument {
	return {
		lineCount: lines.length,
		lineAt: (i: number) => ({ text: lines[i] }),
	} as unknown as vscode.TextDocument;
}

async function fold(lines: string[]) {
	return new GessQFoldingRangeProvider().provideFoldingRanges(
		makeDoc(lines),
		{} as vscode.FoldingContext,
		{} as vscode.CancellationToken,
	);
}

const Region = vscode.FoldingRangeKind.Region;

describe('GessQFoldingRangeProvider', () => {
	test('folds #ifdef / #endif', async () => {
		const r = await fold(['#ifdef A', 'x', 'y', '#endif']);
		expect(r).toContainEqual({ start: 0, end: 2, kind: Region });
	});

	test('folds #ifndef / #endif', async () => {
		const r = await fold(['#ifndef A', 'x', '#endif']);
		expect(r).toContainEqual({ start: 0, end: 1, kind: Region });
	});

	test('folds an #ifdef region even inside a (multi-line) string', async () => {
		const r = await fold([
			'singleq q1;',
			'text = "',
			'Intro #ifdef VARIANTE_A',
			'Variante A',
			'#endif',
			'Rest";',
		]);
		expect(r).toContainEqual({ start: 2, end: 3, kind: Region });
	});

	test('a balanced brace inside a string does not shift the fold', async () => {
		const r = await fold([
			'text = "',
			'<span style="{a:1}">#ifdef X</span>',
			'body',
			'#endif";',
		]);
		expect(r).toContainEqual({ start: 1, end: 2, kind: Region });
	});
});
