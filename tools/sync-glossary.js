'use strict';

/**
 * Merge the GESS Q. keyword index into `src/data/manualGlossary.json`.
 *
 * Non-destructive sync (see HISTORY.md 5.5c):
 *   - keywords in the index but not in the glossary are ADDED as
 *     `{ short, detail }`;
 *   - for keywords already in the glossary the `detail` URL is refreshed only
 *     when the index has a *direct* link (not a multi-target popup) that
 *     differs – `short`, `syntax` and the hand-written `summary` are never
 *     touched;
 *   - keywords whose index entry is a multi-target popup are reported under
 *     "review" instead of auto-changed;
 *   - keywords in the glossary but no longer in the index are kept and only
 *     reported.
 *
 * Run it every year or two, after refreshing the local index copy:
 *
 *   1. save https://help.gessgroup.de/q-help/hmkwindex.html over
 *      tools/index.html   (needs a browser User-Agent, e.g.
 *      `curl -A "Mozilla/5.0 ..." <url> -o tools/index.html`)
 *   2. node tools/sync-glossary.js            # dry run, prints the plan
 *   3. node tools/sync-glossary.js --write    # apply
 *
 * Then fill in `syntax` / `summary` for the new keywords by hand.
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://help.gessgroup.de/q-help/';
const INDEX_HTML = path.join(__dirname, 'index.html');
const GLOSSARY_JSON = path.join(
	__dirname,
	'..',
	'src',
	'data',
	'manualGlossary.json',
);

/** Same normalisation as `normalizeKey` in `src/data/glossary.ts`. */
function normalizeKey(s) {
	return (s || '')
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

const abs = (href) => (/^https?:/i.test(href) ? href : BASE + href);
const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const frag = (h) => clean(h.split('#')[1]);
const pagePath = (h) => clean(h.split('#')[0].split('/').pop().replace(/\.html$/, ''));

/** Levenshtein distance, capped – only small distances matter here. */
function lev(a, b) {
	const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
	for (let j = 0; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			d[i][j] = Math.min(
				d[i - 1][j] + 1,
				d[i][j - 1] + 1,
				d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
	}
	return d[a.length][b.length];
}

/**
 * Multi-target index entries render as a `hmshowLinks('kNN')` popup whose real
 * links sit in `<div id="kNN">`. Score each candidate against the keyword and
 * pick the best; fall back to the first link.
 */
function resolvePopup(html, popupId, label) {
	const div = html.match(
		new RegExp('<div id="' + popupId.replace(/\./g, '\\.') + '"[^>]*>([\\s\\S]*?)</div>'),
	);
	if (!div) {
		return undefined;
	}
	const links = [...div[1].matchAll(/<a href="([^"]+)"[^>]*target="hmcontent"/g)]
		.map((m) => m[1])
		.filter((h) => !/^javascript:/i.test(h));
	if (links.length === 0) {
		return undefined;
	}
	const want = clean(label);
	const score = (h) => {
		const f = frag(h);
		const p = pagePath(h);
		if (f === want || p === want) return 100;
		if (f && (f.includes(want) || (want.length >= 4 && want.includes(f)))) return 80;
		if (p.includes(want) || (want.length >= 4 && want.includes(p))) return 70;
		if (f && lev(f, want) <= 2) return 60 - lev(f, want);
		return 0;
	};
	let best = links[0];
	let bestScore = -1;
	for (const h of links) {
		const s = score(h);
		if (s > bestScore) {
			bestScore = s;
			best = h;
		}
	}
	return abs(best);
}

/**
 * Parse the keyword index. Returns a Map key -> { short, detail, popup }.
 * Direct links win over popup entries that normalise to the same key.
 */
function parseIndex(html) {
	const re =
		/<p class="idxkeyword[12]?"><a ([^>]*)><span class="idxkeyword[12]?">([^<]*)<\/span><\/a><\/p>/g;
	const direct = new Map();
	const popups = new Map();
	let m;
	while ((m = re.exec(html)) !== null) {
		const [, attrs, rawLabel] = m;
		const label = rawLabel.trim();
		const key = normalizeKey(label);
		if (!key) {
			continue;
		}
		const href = (attrs.match(/href="([^"]+)"/) || [])[1] || '';
		const popupId = (attrs.match(/hmshowLinks\('([^']+)'\)/) || [])[1];
		if (/^javascript:/i.test(href)) {
			if (popupId && !popups.has(key)) {
				const detail = resolvePopup(html, popupId, label);
				if (detail) {
					popups.set(key, { short: label, detail, popup: true });
				}
			}
		} else if (href && !direct.has(key)) {
			direct.set(key, { short: label, detail: abs(href), popup: false });
		}
	}
	for (const [key, val] of popups) {
		if (!direct.has(key)) {
			direct.set(key, val);
		}
	}
	return direct;
}

function main() {
	const write = process.argv.includes('--write');

	const html = fs.readFileSync(INDEX_HTML, 'utf8');
	const index = parseIndex(html);
	const glossary = JSON.parse(fs.readFileSync(GLOSSARY_JSON, 'utf8'));

	const added = [];
	const retargeted = [];
	const review = [];

	for (const [key, { short, detail, popup }] of index) {
		const cur = glossary[key];
		if (!cur) {
			glossary[key] = { short, detail };
			added.push(key);
		} else if (cur.detail !== detail && pagePath(cur.detail) !== pagePath(detail)) {
			// Same page but a different / missing #anchor is not worth churning.
			if (popup) {
				review.push(`${key}: ${cur.detail}  (popup suggests ${detail})`);
			} else {
				retargeted.push(`${key}: ${cur.detail} -> ${detail}`);
				cur.detail = detail;
			}
		}
	}

	const orphans = Object.keys(glossary).filter((k) => k && !index.has(k));
	const emptyKey = '' in glossary;
	const missingProse = Object.keys(glossary).filter((k) => k && !glossary[k].summary);

	console.log(`index keywords:       ${index.size}`);
	console.log(`glossary entries:     ${Object.keys(glossary).length}`);
	console.log(`\nadded (${added.length}):`);
	added.forEach((k) => console.log(`  + ${k}  ${glossary[k].detail}`));
	console.log(`\ndetail url refreshed (${retargeted.length}):`);
	retargeted.forEach((l) => console.log(`  ~ ${l}`));
	console.log(`\ndiffers but multi-target – review by hand (${review.length}):`);
	review.forEach((l) => console.log(`  ? ${l}`));
	console.log(`\nin glossary, not in current index – kept (${orphans.length}):`);
	orphans.forEach((k) => console.log(`  . ${k}`));
	if (emptyKey) {
		console.log('\nnote: dropping junk "" key on write');
	}
	console.log(`\nentries still without a hand-written summary: ${missingProse.length}`);

	if (!write) {
		console.log('\ndry run – re-run with --write to apply');
		return;
	}

	// Preserve existing key order; drop the junk "" key; append new keys sorted.
	const ordered = {};
	for (const k of Object.keys(glossary)) {
		if (k && !added.includes(k)) {
			ordered[k] = glossary[k];
		}
	}
	for (const k of added.sort()) {
		ordered[k] = glossary[k];
	}

	// Tab indent + trailing newline to match the repo's Prettier config.
	fs.writeFileSync(GLOSSARY_JSON, JSON.stringify(ordered, null, '\t') + '\n', 'utf8');
	console.log(`\nwrote ${GLOSSARY_JSON} – run \`npx prettier --write\` on it to be safe`);
}

main();
