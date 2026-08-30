import * as fs from 'fs';
import * as path from 'path';
import {
	normalizeKey,
	lookupEntry,
	formatEntryMarkdown,
	type Glossary,
} from '../data/glossary';
import { ALL_KEYWORDS } from '../data/language';

describe('normalizeKey', () => {
	test('lowercases, hyphenates spaces, strips punctuation', () => {
		expect(normalizeKey('Include und IncludeIfExist')).toBe(
			'include-und-includeifexist',
		);
		expect(normalizeKey('@insert()')).toBe('insert');
		expect(normalizeKey('sl_barColor')).toBe('slbarcolor');
	});
});

describe('lookupEntry', () => {
	const g: Glossary = {
		singleq: { short: 'SingleQ', detail: 'https://example/singleq' },
		'foo-bar': { short: 'Foo Bar', detail: 'https://example/foobar' },
	};

	test('direct lowercase hit', () => {
		expect(lookupEntry(g, 'SingleQ')?.short).toBe('SingleQ');
	});

	test('normalised hit', () => {
		expect(lookupEntry(g, 'Foo Bar')?.short).toBe('Foo Bar');
	});

	test('miss returns undefined', () => {
		expect(lookupEntry(g, 'nope')).toBeUndefined();
	});
});

describe('formatEntryMarkdown', () => {
	test('bare entry: heading + link', () => {
		const md = formatEntryMarkdown('singleq', {
			short: 'SingleQ',
			detail: 'https://example/singleq',
		});
		expect(md).toBe('**singleq** — SingleQ\n\nhttps://example/singleq');
	});

	test('enriched entry: heading, syntax block, summary, link', () => {
		const md = formatEntryMarkdown('array', {
			short: 'Array',
			detail: 'https://example/array',
			syntax: 'Array NAME[#WERTE];',
			summary: 'Speichert mehrere Zahlen.',
		});
		expect(md).toBe(
			'**array** — Array\n\n' +
				'```gessq\nArray NAME[#WERTE];\n```\n\n' +
				'Speichert mehrere Zahlen.\n\n' +
				'https://example/array',
		);
	});
});

describe('manualGlossary.json coverage', () => {
	const glossary = JSON.parse(
		fs.readFileSync(
			path.resolve(__dirname, '..', 'data', 'manualGlossary.json'),
			'utf8',
		),
	) as Glossary;

	test('every language.ts keyword resolves to a hover entry', () => {
		const missing = ALL_KEYWORDS.filter((kw) => !lookupEntry(glossary, kw));
		expect(missing).toEqual([]);
	});

	test('*ActionBlock syntax hints use the keyword, not a "NAME" placeholder', () => {
		const bad = Object.entries(glossary)
			.filter(
				([k]) => k.endsWith('actionblock') && k !== 'actionblock',
			)
			.filter(([, e]) => !e.syntax || /\bNAME\b/.test(e.syntax))
			.map(([k]) => k);
		expect(bad).toEqual([]);
	});

	test('every resolved entry has a summary', () => {
		const noSummary = ALL_KEYWORDS.filter((kw) => {
			const e = lookupEntry(glossary, kw);
			return e && !e.summary;
		});
		expect(noSummary).toEqual([]);
	});
});
