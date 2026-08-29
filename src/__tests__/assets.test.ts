import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** Strip whole-line `//` comments so JSONC files can go through JSON.parse. */
const stripLineComments = (s: string) =>
	s
		.split('\n')
		.map((l) => (/^\s*\/\//.test(l) ? '' : l))
		.join('\n');

describe('language-configuration.json', () => {
	const cfg = JSON.parse(
		stripLineComments(read('language-configuration.json')),
	);

	test('is valid JSON(C)', () => {
		expect(cfg).toBeTruthy();
	});

	test('declares comment delimiters', () => {
		expect(cfg.comments.lineComment).toBe('//');
		expect(cfg.comments.blockComment).toEqual(['/*', '*/']);
	});

	test('all regex-valued fields compile as RegExp', () => {
		expect(() => new RegExp(cfg.wordPattern)).not.toThrow();
		expect(
			() => new RegExp(cfg.indentationRules.increaseIndentPattern),
		).not.toThrow();
		expect(
			() => new RegExp(cfg.indentationRules.decreaseIndentPattern),
		).not.toThrow();
		for (const rule of cfg.onEnterRules ?? []) {
			expect(() => new RegExp(rule.beforeText)).not.toThrow();
		}
	});
});

describe('language/snippets.json', () => {
	const snippets = JSON.parse(read('language/snippets.json')) as Record<
		string,
		{ prefix: string | string[]; body: string | string[]; scope?: string }
	>;

	test('is valid JSON with entries', () => {
		expect(Object.keys(snippets).length).toBeGreaterThan(50);
	});

	test('no entry uses the invalid "scope" field', () => {
		const withScope = Object.entries(snippets)
			.filter(([, e]) => 'scope' in e)
			.map(([k]) => k);
		expect(withScope).toEqual([]);
	});

	test('prefixes have no commas, newlines or edge whitespace', () => {
		const bad: string[] = [];
		for (const [key, e] of Object.entries(snippets)) {
			const prefixes = Array.isArray(e.prefix) ? e.prefix : [e.prefix];
			for (const p of prefixes) {
				if (typeof p !== 'string' || /,|[\r\n]|^\s|\s$/.test(p)) {
					bad.push(key);
				}
			}
		}
		expect(bad).toEqual([]);
	});

	test('keys contain no newline characters', () => {
		const bad = Object.keys(snippets).filter((k) => /[\r\n]/.test(k));
		expect(bad).toEqual([]);
	});
});

describe('language/gessq.tmLanguage.json', () => {
	const grammar = JSON.parse(read('language/gessq.tmLanguage.json'));

	test('scopeName matches package.json contribution', () => {
		const pkg = JSON.parse(read('package.json'));
		expect(grammar.scopeName).toBe(pkg.contributes.grammars[0].scopeName);
	});

	// Note: grammar patterns use Oniguruma syntax (e.g. `(?i)` inline flags),
	// which is not valid JS RegExp – so they are only sanity-checked, not
	// compiled here.
	test('match / begin / end patterns are non-empty single-line strings', () => {
		const bad: string[] = [];
		const walk = (node: unknown): void => {
			if (!node || typeof node !== 'object') {
				return;
			}
			const obj = node as Record<string, unknown>;
			for (const key of ['match', 'begin', 'end']) {
				const v = obj[key];
				if (
					v !== undefined &&
					(typeof v !== 'string' || v.length === 0 || /\n/.test(v))
				) {
					bad.push(`${key}: ${JSON.stringify(v)}`);
				}
			}
			for (const v of Object.values(obj)) {
				if (Array.isArray(v)) {
					v.forEach(walk);
				} else if (v && typeof v === 'object') {
					walk(v);
				}
			}
		};
		walk(grammar);
		expect(bad).toEqual([]);
	});
});

describe('manualGlossary.json', () => {
	const g = JSON.parse(read('src/data/manualGlossary.json')) as Record<
		string,
		{
			short: string;
			detail: string;
			syntax?: string;
			summary?: string;
		}
	>;
	const keys = Object.keys(g);

	test('parses to an object of entries', () => {
		expect(keys.length).toBeGreaterThan(100);
	});

	test('every entry has string short + detail; optional syntax/summary are strings', () => {
		const bad: string[] = [];
		for (const k of keys) {
			const e = g[k];
			if (typeof e.short !== 'string' || typeof e.detail !== 'string') {
				bad.push(k + ' (short/detail)');
			}
			if ('syntax' in e && typeof e.syntax !== 'string') {
				bad.push(k + ' (syntax)');
			}
			if ('summary' in e && typeof e.summary !== 'string') {
				bad.push(k + ' (summary)');
			}
		}
		expect(bad).toEqual([]);
	});

	test('detail is an https handbook URL', () => {
		const bad = keys.filter(
			(k) => !/^https:\/\/help\.gessgroup\.de\//.test(g[k].detail),
		);
		expect(bad).toEqual([]);
	});

	test('one-line syntax hints (no newlines)', () => {
		const bad = keys.filter((k) => g[k].syntax?.includes('\n'));
		expect(bad).toEqual([]);
	});
});

describe('package.json contributions', () => {
	const pkg = JSON.parse(read('package.json'));

	test('grammar / language config / snippet paths exist (case-sensitive)', () => {
		const rels = [
			pkg.contributes.languages[0].configuration,
			pkg.contributes.grammars[0].path,
			pkg.contributes.snippets[0].path,
		].map((p: string) => p.replace(/^\.\//, ''));
		for (const rel of rels) {
			const abs = path.join(root, rel);
			expect(fs.existsSync(abs)).toBe(true);
			expect(fs.readdirSync(path.dirname(abs))).toContain(
				path.basename(rel),
			);
		}
	});
});
