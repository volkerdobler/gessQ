import * as fs from 'fs';
import * as path from 'path';
import {
	ALL_KEYWORDS,
	CORE_KEYWORDS,
	COMMANDS,
	PARAMETERS,
} from '../data/language';

test('keyword lists are non-empty, lowercase and sorted', () => {
	for (const list of [CORE_KEYWORDS, COMMANDS, PARAMETERS, ALL_KEYWORDS]) {
		expect(list.length).toBeGreaterThan(0);
		expect(list).toEqual([...list].sort());
		expect(list.every((w) => w === w.toLowerCase())).toBe(true);
	}
});

test('ALL_KEYWORDS is de-duplicated and covers the core question types', () => {
	expect(new Set(ALL_KEYWORDS).size).toBe(ALL_KEYWORDS.length);
	for (const t of ['singleq', 'multiq', 'numq', 'block', 'screen']) {
		expect(ALL_KEYWORDS).toContain(t);
	}
});

test('every grammar core keyword is present in ALL_KEYWORDS', () => {
	const root = path.resolve(__dirname, '..', '..');
	const grammar = JSON.parse(
		fs.readFileSync(
			path.join(root, 'language', 'gessq.tmLanguage.json'),
			'utf8',
		),
	);
	const core: string = grammar.patterns[0].match;
	const words = (core.match(/[a-z][a-z0-9_]+/gi) || [])
		.map((w) => w.toLowerCase())
		.filter((w) => w !== 'i'); // drop the (?i) flag artefact
	for (const w of words) {
		expect(ALL_KEYWORDS).toContain(w);
	}
});
