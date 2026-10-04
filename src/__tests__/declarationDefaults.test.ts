import * as vscode from 'vscode';
import {
	parseDeclarationDefaults,
	lookupDefault,
	propertySnippet,
	propertySlot,
	assignmentSnippet,
	type PropertyDefault,
} from '../core/declarationDefaults';
import {
	withDeclarationDefault,
	EmbeddedCompletionProvider,
} from '../providers/embeddedLanguage';

const DTS = `
interface CogmapSettings {
	/** Anzahl Gruppen beim Start. @default 2 */
	initialGroups?: number;
	/** Höchstanzahl Gruppen, \`null\` = unbegrenzt. @default null */
	maxGroups?: number | null;
	/** Darstellung auf großen Bildschirmen. @default 'board' */
	modeLarge?: 'board' | 'cardstack';
	/** Drag & Drop. @default true */
	enableDragDrop?: boolean;
	/** Eigene Texte für die Tour-Schritte. @default {} */
	tourTexts?: Record<string, string>;
	/** Platzhalter \`{n}\`. @default '{n} Produkte ausgewählt' */
	txtMultiSelected?: string;
	/** Ohne Default. */
	plain?: string;
	/**
	 * Mehrzeilig.
	 * @default 'Los geht’s'
	 */
	txtOverviewStart?: string;
}

interface DLabSettings {
	/** @default 10 */
	allowedClicks?: number;
	/** @default false */
	withGuidedTour?: boolean;
	/** Doppelt, anderer Default. @default 5 */
	initialGroups?: number;
	/** @default "it's" */
	quoteInside?: string;
}
`;

const defaults = parseDeclarationDefaults(DTS);
const snip = (name: string, detail?: string) =>
	propertySnippet(lookupDefault(defaults, name, detail) as PropertyDefault);

describe('parseDeclarationDefaults', () => {
	test('reads single-line and multi-line @default with its interface', () => {
		expect(defaults.get('allowedClicks')).toEqual([
			{
				iface: 'DLabSettings',
				name: 'allowedClicks',
				type: 'number',
				value: '10',
			},
		]);
		expect(defaults.get('txtOverviewStart')?.[0].value).toBe(
			"'Los geht’s'",
		);
		expect(defaults.get('modeLarge')?.[0].type).toBe(
			"'board' | 'cardstack'",
		);
	});

	test('members without @default are skipped', () => {
		expect(defaults.has('plain')).toBe(false);
	});
});

describe('lookupDefault', () => {
	test('a name declared twice with different defaults needs the detail', () => {
		expect(lookupDefault(defaults, 'initialGroups')).toBeUndefined();
		expect(
			lookupDefault(
				defaults,
				'initialGroups',
				'(property) CogmapSettings.initialGroups?: number',
			)?.value,
		).toBe('2');
		expect(
			lookupDefault(
				defaults,
				'initialGroups',
				'(property) DLabSettings.initialGroups?: number',
			)?.value,
		).toBe('5');
	});
});

describe('propertySnippet', () => {
	test('number / null / object: the default as selected placeholder', () => {
		expect(snip('allowedClicks')).toBe('allowedClicks: ${1:10}');
		expect(snip('maxGroups')).toBe('maxGroups: ${1:null}');
		expect(snip('tourTexts')).toBe('tourTexts: ${1:{\\}}');
	});

	test('boolean: a choice with the default first', () => {
		expect(snip('enableDragDrop')).toBe('enableDragDrop: ${1|true,false|}');
		expect(snip('withGuidedTour')).toBe('withGuidedTour: ${1|false,true|}');
	});

	test('string-literal union: a quoted choice with the default first', () => {
		expect(snip('modeLarge')).toBe("modeLarge: '${1|board,cardstack|}'");
	});

	test('string: single-quoted, the text selected, "}" escaped', () => {
		expect(snip('txtMultiSelected')).toBe(
			"txtMultiSelected: '${1:{n\\} Produkte ausgewählt}'",
		);
		expect(snip('txtOverviewStart')).toBe(
			"txtOverviewStart: '${1:Los geht’s}'",
		);
	});

	test('a text containing \' falls back to the Q. escape \\"', () => {
		expect(snip('quoteInside')).toBe('quoteInside: \\\\"${1:it\'s}\\\\"');
	});
});

describe('propertySlot', () => {
	test('after "{" or "," (also across lines) → object key', () => {
		expect(propertySlot('SEQdot.settings = { ', '')).toBe('key');
		expect(
			propertySlot('SEQdot.settings = {\n\tminGroups: 2,\n\tmax', ''),
		).toBe('key');
		expect(
			propertySlot('SEQdot.settings = { max', ': 3 }'),
		).toBeUndefined();
	});

	test('member chain starting a statement → assignment', () => {
		// the block text right after javascript=" (the user's example)
		expect(propertySlot('\n\tSEQdot.settings.txtClose', '')).toBe('assign');
		expect(propertySlot('SEQdot.settings.', '')).toBe('assign');
		expect(propertySlot('x = 1;\nSEQdot.settings.min', '')).toBe('assign');
		expect(propertySlot('if (a) { SEQdot.settings.min', '')).toBe('assign');
		// new line without ";" – still a new statement
		expect(propertySlot('x = 1\nSEQdot.settings.min', '')).toBe('assign');
	});

	test('member access inside an expression → nothing', () => {
		expect(propertySlot('if (SEQdot.settings.min', '')).toBeUndefined();
		expect(propertySlot('var x = SEQdot.settings.min', '')).toBeUndefined();
		expect(propertySlot('f(a,\n  SEQdot.settings.min', '')).toBeUndefined();
		expect(
			propertySlot('x = 1 +\nSEQdot.settings.min', ''),
		).toBeUndefined();
	});

	test('already followed by "=", "(" or "." → nothing', () => {
		expect(
			propertySlot('SEQdot.settings.min', 'Groups = 3;'),
		).toBeUndefined();
		expect(propertySlot('SEQdot.settings.min', '()')).toBeUndefined();
		expect(propertySlot('SEQdot.sett', 'ings.minGroups')).toBeUndefined();
	});

	test('plain statements → nothing', () => {
		expect(propertySlot('var x = ', '')).toBeUndefined();
		expect(propertySlot('SEQdot', '')).toBeUndefined();
	});
});

describe('assignmentSnippet', () => {
	const p = (name: string) =>
		lookupDefault(defaults, name) as PropertyDefault;
	test('"name = default;" – without ";" when one already follows', () => {
		expect(assignmentSnippet(p('allowedClicks'))).toBe(
			'allowedClicks = ${1:10};',
		);
		expect(assignmentSnippet(p('modeLarge'), false)).toBe(
			"modeLarge = '${1|board,cardstack|}'",
		);
	});
});

describe('EmbeddedCompletionProvider – the user’s example end to end', () => {
	const real = vscode.commands.executeCommand;
	afterEach(() => {
		(vscode.commands as { executeCommand: unknown }).executeCommand = real;
	});

	const SRC = 'javascript="\n\tSEQdot.settings.txtClose\n";';
	const lines = SRC.split('\n');
	const doc = {
		uri: vscode.Uri.file('/ws/e2e.q'),
		languageId: 'gessq',
		version: 1,
		lineCount: lines.length,
		getText: () => SRC,
		lineAt: (i: number) => ({ text: lines[i] }),
		offsetAt: (pos: vscode.Position) =>
			lines.slice(0, pos.line).reduce((n, l) => n + l.length + 1, 0) +
			pos.character,
	} as unknown as vscode.TextDocument;

	test('txtCloseButton is inserted as "txtCloseButton = \'Schließen\';"', async () => {
		(vscode.commands as { executeCommand: unknown }).executeCommand = () =>
			Promise.resolve(
				new vscode.CompletionList([
					new vscode.CompletionItem(
						'txtCloseButton?',
						vscode.CompletionItemKind.Field,
					),
				]),
			);
		const provider = new EmbeddedCompletionProvider();
		provider.setDeclarationDefaults(
			parseDeclarationDefaults(
				"interface S {\n\t/** @default 'Schließen' */\n\ttxtCloseButton?: string;\n}",
			),
		);
		const list = await provider.provideCompletionItems(
			doc,
			new vscode.Position(1, 25),
			{ isCancellationRequested: false } as vscode.CancellationToken,
			{} as vscode.CompletionContext,
		);
		expect((list!.items[0].insertText as vscode.SnippetString).value).toBe(
			"txtCloseButton = '${1:Schließen}';",
		);
	});
});

describe('withDeclarationDefault', () => {
	const make = (label: string, kind: vscode.CompletionItemKind) =>
		new vscode.CompletionItem(label, kind);

	test('a property item (label with "?") gets the snippet', () => {
		const it = withDeclarationDefault(
			make('allowedClicks?', vscode.CompletionItemKind.Field),
			defaults,
		);
		expect((it.insertText as vscode.SnippetString).value).toBe(
			'allowedClicks: ${1:10}',
		);
	});

	test('non-properties and unknown names stay untouched', () => {
		expect(
			withDeclarationDefault(
				make('allowedClicks', vscode.CompletionItemKind.Variable),
				defaults,
			).insertText,
		).toBeUndefined();
		expect(
			withDeclarationDefault(
				make('plain?', vscode.CompletionItemKind.Field),
				defaults,
			).insertText,
		).toBeUndefined();
	});
});
