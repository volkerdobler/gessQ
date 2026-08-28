import { parseIncludes } from '../core/includes';
import * as vscode from 'vscode';

let n = 0;
function makeDoc(lines: string[]): vscode.TextDocument {
	const uri = vscode.Uri.file(`/ws/sub/main-${++n}.q`);
	return {
		uri,
		lineCount: lines.length,
		version: 1,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(i, 0, i, lines[i].length),
		}),
	} as unknown as vscode.TextDocument;
}

test('parses #include and resolves it against the document folder', () => {
	const [inc] = parseIncludes(makeDoc(['#include "parts/labels.q";']));
	expect(inc.keyword).toBe('include');
	expect(inc.optional).toBe(false);
	expect(inc.target).toBe('parts/labels.q');
	expect(inc.resolved.path).toBe('/ws/sub/parts/labels.q');
});

test('parses #includeifexists as optional and resolves "../"', () => {
	const [inc] = parseIncludes(makeDoc(["#includeifexists '../shared/x.q';"]));
	expect(inc.optional).toBe(true);
	expect(inc.resolved.path).toBe('/ws/shared/x.q');
});

test('targetRange covers exactly the path text', () => {
	const line = '  #include "a.q";';
	const [inc] = parseIncludes(makeDoc([line]));
	expect(
		line.slice(
			inc.targetRange.start.character,
			inc.targetRange.end.character,
		),
	).toBe('a.q');
});

test('ignores #include inside a comment', () => {
	expect(parseIncludes(makeDoc(['// #include "x.q";'])).length).toBe(0);
});
