import * as fs from 'fs';
import * as path from 'path';
import { ALL_KEYWORDS } from '../data/language';
import { KEYWORD_INDEX_IGNORE } from './fixtures/keywordIndexIgnore';

/**
 * Guards that a handbook update does not silently introduce a GESS Q. keyword
 * the extension neither highlights nor documents (see HISTORY.md §9.8 / B1).
 *
 * `tools/index.html` is the committed snapshot of
 * https://help.gessgroup.de/q-help/hmkwindex.html. Every "code-shaped" label
 * in it must be either a grammar keyword (`ALL_KEYWORDS`) or listed in the
 * baseline ignore list (non-keyword topics, config-file params, CSS classes,
 * template JS vars, UI terms). `tools/sync-glossary.js` refreshes the
 * snapshot; after that, a failing test means a new entry needs to go into the
 * grammar or the ignore list.
 */

const root = path.resolve(__dirname, '..', '..');

function indexKeywordLabels(): string[] {
	const html = fs.readFileSync(
		path.join(root, 'tools', 'index.html'),
		'utf8',
	);
	const labels = new Set<string>();
	const linked =
		/<p class="idxkeyword[12]?"><a [^>]*><span class="idxkeyword[12]?">([^<]*)<\/span><\/a><\/p>/g;
	const bare =
		/<p class="idxkeyword[12]?"><span class="idxkeyword[12]?">([^<]*)<\/span><\/p>/g;
	for (const re of [linked, bare]) {
		let m: RegExpExecArray | null;
		while ((m = re.exec(html))) {
			labels.add(m[1].trim());
		}
	}
	return [...labels];
}

// Single-identifier labels only – "@insert()", comment markers and multi-word
// topic titles ("Grafische Buttons") are never keywords.
const isCodeShaped = (s: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);

describe('keyword index ↔ grammar', () => {
	const known = new Set<string>([...ALL_KEYWORDS, ...KEYWORD_INDEX_IGNORE]);

	test('every code-shaped index label is a grammar keyword or ignored', () => {
		const unknown = indexKeywordLabels()
			.filter(isCodeShaped)
			.map((l) => l.toLowerCase())
			.filter((l) => !known.has(l))
			.filter((v, i, a) => a.indexOf(v) === i)
			.sort();
		expect(unknown).toEqual([]);
	});

	test('the ignore list has no entries that are now real grammar keywords', () => {
		const kw = new Set(ALL_KEYWORDS);
		const stale = KEYWORD_INDEX_IGNORE.filter((k) => kw.has(k));
		expect(stale).toEqual([]);
	});

	test('the ignore list is lower-case, unique and sorted', () => {
		const arr = [...KEYWORD_INDEX_IGNORE];
		expect(arr).toEqual(arr.map((s) => s.toLowerCase()));
		expect(new Set(arr).size).toBe(arr.length);
		expect(arr).toEqual([...arr].sort());
	});
});
