import { getScopeAt, ScopeEnum } from '../components/scopeComponent';
import * as vscode from 'vscode';

// Minimal fake TextDocument matching the properties used by getScopeAt
function makeDoc(lines: string[]) {
	return {
		uri: { toString: () => 'test://doc' },
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({ text: lines[i], range: {} as any }),
	} as unknown as vscode.TextDocument;
}

test('getScopeAt detects line comment', () => {
	const doc = makeDoc(['let a = 1; // comment here']);
	const idxCode = doc.lineAt(0).text.indexOf('let');
	const idxComment = doc.lineAt(0).text.indexOf('//') + 1; // inside comment
	expect(getScopeAt(doc, 0, idxCode)).toBe(ScopeEnum.normal);
	expect(getScopeAt(doc, 0, idxComment)).toBe(ScopeEnum.comment);
});

test('getScopeAt detects string and escapes', () => {
	const doc = makeDoc([`const s = "hello \"world\"";`]);
	const idxBefore = doc.lineAt(0).text.indexOf('const');
	const idxInString = doc.lineAt(0).text.indexOf('hello');
	const idxQuote = doc.lineAt(0).text.indexOf('"');

	expect(getScopeAt(doc, 0, idxBefore)).toBe(ScopeEnum.normal);
	expect(getScopeAt(doc, 0, idxInString)).toBe(ScopeEnum.string);
	// the closing escaped quote should not end the string
	expect(getScopeAt(doc, 0, idxQuote + 1)).toBe(ScopeEnum.string);
});

test('getScopeAt detects block comments across lines', () => {
	const doc = makeDoc(['code /* start', 'inside comment */ code']);
	expect(getScopeAt(doc, 0, 6)).toBe(ScopeEnum.comment); // inside block start
	expect(getScopeAt(doc, 1, 2)).toBe(ScopeEnum.comment); // still inside block
	const idxAfter = doc.lineAt(1).text.indexOf('code');
	expect(getScopeAt(doc, 1, idxAfter)).toBe(ScopeEnum.normal);
});
