import * as vscode from 'vscode';
import {
	GessQSignatureProvider,
	findCallOpen,
	callArgsContain,
	dismissAt,
	isDismissed,
	clearDismissal,
} from '../providers/signatureProvider';

function makeDoc(text: string, uri = 'file:///q1.q'): vscode.TextDocument {
	const lines = text.split('\n');
	return {
		uri: { toString: () => uri, path: '/q1.q', scheme: 'file' },
		languageId: 'gessq',
		version: 1,
		lineCount: lines.length,
		getText: () => text,
		lineAt: (line: number) => ({ text: lines[line] }),
		offsetAt: (p: vscode.Position) => {
			let off = 0;
			for (let i = 0; i < p.line; i++) {
				off += lines[i].length + 1;
			}
			return off + p.character;
		},
	} as unknown as vscode.TextDocument;
}

const token = {
	isCancellationRequested: false,
} as unknown as vscode.CancellationToken;
const ctx = {} as vscode.SignatureHelpContext;

//            0         1         2         3
//            0123456789012345678901234567890123456
const LINE = '#mymacro(a, inner(b, c), d) #other(x)';

describe('findCallOpen / callArgsContain', () => {
	it('finds the paren of the enclosing call', () => {
		expect(findCallOpen(LINE, 10)).toBe(8);
		expect(findCallOpen(LINE, 19)).toBe(17);
		expect(findCallOpen(LINE, 25)).toBe(8);
		expect(findCallOpen(LINE, 3)).toBe(-1);
	});

	it('treats nested calls as inside and stops at the matching paren', () => {
		expect(callArgsContain(LINE, 8, 9)).toBe(true);
		expect(callArgsContain(LINE, 8, 19)).toBe(true);
		expect(callArgsContain(LINE, 8, 26)).toBe(true);
		expect(callArgsContain(LINE, 8, 27)).toBe(false);
		expect(callArgsContain(LINE, 8, 35)).toBe(false);
		expect(callArgsContain(LINE, 8, 8)).toBe(false);
	});
});

describe('signature help dismissal', () => {
	afterEach(() => clearDismissal());

	const doc = makeDoc(['x', LINE].join('\n'));
	const at = (c: number) => new vscode.Position(1, c);

	it('keeps the hints closed within the dismissed call', async () => {
		expect(dismissAt(doc, at(10))).toBe(true);
		expect(isDismissed(doc, at(12))).toBe(true);
		expect(isDismissed(doc, at(19))).toBe(true);
		const provider = new GessQSignatureProvider(
			vscode.Uri.parse('file:///ext'),
		);
		expect(
			await provider.provideSignatureHelp(doc, at(19), token, ctx),
		).toBeNull();
	});

	it('does not apply outside the call, on other lines or documents', () => {
		dismissAt(doc, at(10));
		expect(isDismissed(doc, at(36))).toBe(false);
		expect(isDismissed(doc, at(5))).toBe(false);
		expect(isDismissed(doc, new vscode.Position(0, 1))).toBe(false);
		const other = makeDoc(['x', LINE].join('\n'), 'file:///q2.q');
		expect(isDismissed(other, at(12))).toBe(false);
	});

	it('records nothing outside a call', () => {
		expect(dismissAt(doc, at(3))).toBe(false);
		expect(isDismissed(doc, at(10))).toBe(false);
	});
});
