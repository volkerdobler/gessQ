import { Scope, ScopeEnum } from '../core/scope';
import * as vscode from 'vscode';

/** Minimal fake TextDocument covering what `Scope` reads. */
function makeDoc(lines: string[]): vscode.TextDocument {
	return {
		uri: { toString: () => 'test://doc' },
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({ text: lines[i], range: {} as vscode.Range }),
	} as unknown as vscode.TextDocument;
}

const scopeAt = (lines: string[], line: number, ch: number) =>
	new Scope(makeDoc(lines)).getScope(line, ch);

test('detects a line comment', () => {
	const text = 'set a = 1; // comment here';
	expect(scopeAt([text], 0, text.indexOf('set'))).toBe(ScopeEnum.normal);
	expect(scopeAt([text], 0, text.indexOf('//') + 1)).toBe(ScopeEnum.comment);
});

test('detects a string and treats \\" as an escape', () => {
	const text = 'const s = "hello \\"world\\"";';
	expect(scopeAt([text], 0, text.indexOf('const'))).toBe(ScopeEnum.normal);
	expect(scopeAt([text], 0, text.indexOf('hello'))).toBe(ScopeEnum.string);
	// the escaped quote must not end the string
	expect(scopeAt([text], 0, text.indexOf('\\"') + 1)).toBe(ScopeEnum.string);
	expect(scopeAt([text], 0, text.indexOf('world'))).toBe(ScopeEnum.string);
	// after the real closing quote we are back to normal
	expect(scopeAt([text], 0, text.length - 1)).toBe(ScopeEnum.normal);
});

test('detects block comments spanning lines', () => {
	const lines = ['code /* start', 'inside comment */ code'];
	expect(scopeAt(lines, 0, 6)).toBe(ScopeEnum.comment);
	expect(scopeAt(lines, 1, 2)).toBe(ScopeEnum.comment);
	expect(scopeAt(lines, 1, lines[1].indexOf('code'))).toBe(ScopeEnum.normal);
});

test('detects strings spanning lines (gessQ text="…" blocks)', () => {
	const lines = ['text="', 'Fragentext', '";'];
	expect(scopeAt(lines, 1, 3)).toBe(ScopeEnum.string);
	expect(scopeAt(lines, 2, 0)).toBe(ScopeEnum.string);
});

test('a string opener inside a line comment is ignored', () => {
	const text = '// he said "hi';
	expect(scopeAt([text], 0, text.indexOf('hi'))).toBe(ScopeEnum.comment);
});

test('out-of-range positions (incl. -1 from String.search) return undefined', () => {
	expect(scopeAt(['abc'], 0, -1)).toBeUndefined();
	expect(scopeAt(['abc'], 0, 99)).toBeUndefined();
	expect(scopeAt(['abc'], 5, 0)).toBeUndefined();
});
