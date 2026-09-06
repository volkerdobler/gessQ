import * as vscode from 'vscode';
import {
	virtualUri,
	originalUriString,
	embeddedRegionAt,
	suppressForEmbedded,
	sanitizeCompletionItem,
	EmbeddedContentProvider,
	EmbeddedHoverProvider,
} from '../providers/embeddedLanguage';

function makeDoc(text: string, uri = 'file:///q1.q'): vscode.TextDocument {
	const lines = text.split('\n');
	return {
		uri: { toString: () => uri, path: '/q1.q', scheme: 'file' },
		languageId: 'gessq',
		version: 1,
		lineCount: lines.length,
		getText: () => text,
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

const SCRIPT = [
	'singleq q1;',
	'text = "hi";',
	'javascript = "',
	'QDot.onSubmit = function(){ return false; };',
	'";',
].join('\n');

describe('virtual URI round-trip', () => {
	test('encodes the original .q URI and is reversible', () => {
		const original = vscode.Uri.parse('file:///c:/x/my script.q');
		const js = virtualUri(original, 'javascript');
		const css = virtualUri(original, 'css');
		expect(js.scheme).toBe('gessq-embedded-js');
		expect(css.scheme).toBe('gessq-embedded-css');
		expect(js.path.endsWith('.ts')).toBe(true);
		expect(css.path.endsWith('.css')).toBe(true);
		expect(originalUriString(js)).toBe(original.toString());
		expect(originalUriString(css)).toBe(original.toString());
	});
});

describe('embeddedRegionAt / suppressForEmbedded', () => {
	const doc = makeDoc(SCRIPT);
	const inside = new vscode.Position(3, 5); // within QDot.onSubmit line
	const outside = new vscode.Position(0, 3); // "singleq"

	test('detects the region under the cursor', () => {
		expect(embeddedRegionAt(doc, inside)?.language).toBe('javascript');
		expect(embeddedRegionAt(doc, outside)).toBeUndefined();
	});

	test('suppressForEmbedded follows the region (feature defaults on)', () => {
		expect(suppressForEmbedded(doc, inside)).toBe(true);
		expect(suppressForEmbedded(doc, outside)).toBe(false);
	});
});

describe('EmbeddedContentProvider', () => {
	const doc = makeDoc(SCRIPT);
	const provider = new EmbeddedContentProvider();
	provider.setGlobals('declare var QDot: any;');

	beforeAll(() => {
		(
			vscode.workspace as unknown as { textDocuments: unknown[] }
		).textDocuments = [doc];
	});
	afterAll(() => {
		(
			vscode.workspace as unknown as { textDocuments: unknown[] }
		).textDocuments = [];
	});

	test('JS virtual content keeps the block, blanks the rest, appends globals', () => {
		const content = provider.provideTextDocumentContent(
			virtualUri(doc.uri, 'javascript'),
		);
		expect(content).toContain(
			'QDot.onSubmit = function(){ return false; };',
		);
		expect(content.split('\n')[0]).toBe(' '.repeat('singleq q1;'.length));
		expect(content.endsWith('\ndeclare var QDot: any;')).toBe(true);
	});

	test('unknown original URI yields empty content', () => {
		const stray = virtualUri(
			vscode.Uri.parse('file:///nope.q'),
			'javascript',
		);
		expect(provider.provideTextDocumentContent(stray)).toBe('');
	});
});

describe('sanitizeCompletionItem', () => {
	test('drops additionalTextEdits and non-parameter-hint commands', () => {
		const it = {
			label: 'foo',
			additionalTextEdits: [{}],
			command: { command: '_typescript.applyCompletionCodeAction' },
		} as unknown as vscode.CompletionItem;
		sanitizeCompletionItem(it);
		expect(it.additionalTextEdits).toBeUndefined();
		expect(it.command).toBeUndefined();
	});

	test('keeps the parameter-hint re-trigger command', () => {
		const it = {
			label: 'bar',
			command: { command: 'editor.action.triggerParameterHints' },
		} as unknown as vscode.CompletionItem;
		sanitizeCompletionItem(it);
		expect(it.command).toEqual({
			command: 'editor.action.triggerParameterHints',
		});
	});
});

describe('EmbeddedHoverProvider forwarding', () => {
	const doc = makeDoc(SCRIPT);
	const real = vscode.commands.executeCommand;
	afterEach(() => {
		(vscode.commands as { executeCommand: unknown }).executeCommand = real;
	});

	test('forwards to the virtual JS URI and passes the hover through', async () => {
		const calls: unknown[][] = [];
		(vscode.commands as { executeCommand: unknown }).executeCommand = (
			...args: unknown[]
		) => {
			calls.push(args);
			return Promise.resolve([new vscode.Hover(['**QDot**'])]);
		};

		const hover = await new EmbeddedHoverProvider().provideHover(
			doc,
			new vscode.Position(3, 5),
			token,
		);
		expect(hover).not.toBeUndefined();
		expect(calls).toHaveLength(1);
		expect(calls[0][0]).toBe('vscode.executeHoverProvider');
		expect((calls[0][1] as vscode.Uri).scheme).toBe('gessq-embedded-js');
	});

	test('returns undefined outside a region without forwarding', async () => {
		let called = false;
		(vscode.commands as { executeCommand: unknown }).executeCommand =
			() => {
				called = true;
				return Promise.resolve([]);
			};
		const hover = await new EmbeddedHoverProvider().provideHover(
			doc,
			new vscode.Position(0, 3),
			token,
		);
		expect(hover).toBeUndefined();
		expect(called).toBe(false);
	});
});
