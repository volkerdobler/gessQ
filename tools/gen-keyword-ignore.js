'use strict';

/**
 * Regenerate `src/__tests__/fixtures/keywordIndexIgnore.ts` – the baseline of
 * keyword-index labels that are NOT GESS Q. grammar keywords (see HISTORY.md §9.8).
 *
 * Run after `tools/sync-glossary.js` has refreshed `tools/index.html`:
 *
 *   node tools/gen-keyword-ignore.js          # dry run – prints add/remove
 *   node tools/gen-keyword-ignore.js --write  # apply
 *
 * On --write it KEEPS every entry that is still a non-keyword index label and
 * DROPS entries no longer in the index; genuinely new keywords are printed so
 * they can be triaged into the grammar instead.
 */

const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.join(__dirname, 'index.html');
const LANGUAGE_TS = path.join(__dirname, '..', 'src', 'data', 'language.ts');
const FIXTURE = path.join(
	__dirname,
	'..',
	'src',
	'__tests__',
	'fixtures',
	'keywordIndexIgnore.ts',
);

const grammarKeywords = () =>
	new Set(
		[...fs.readFileSync(LANGUAGE_TS, 'utf8').matchAll(/^\t'([^']+)',/gm)].map(
			(m) => m[1].toLowerCase(),
		),
	);

function indexLabels() {
	const html = fs.readFileSync(INDEX_HTML, 'utf8');
	const labels = new Set();
	const res = [
		/<p class="idxkeyword[12]?"><a [^>]*><span class="idxkeyword[12]?">([^<]*)<\/span><\/a><\/p>/g,
		/<p class="idxkeyword[12]?"><span class="idxkeyword[12]?">([^<]*)<\/span><\/p>/g,
	];
	for (const re of res) {
		let m;
		while ((m = re.exec(html))) {
			labels.add(m[1].trim());
		}
	}
	return [...labels];
}

const HEADER = `// AUTO-GENERATED BASELINE – regenerate with \`node tools/gen-keyword-ignore.js --write\`
// after refreshing tools/index.html (see tools/README.md).
//
// Schlüsselwort-Index-Einträge, die KEINE GESS Q.-Grammar-Keywords sind:
// Abschnittsüberschriften, qonline.cfg-Parameter, CSS-Klassen, Template-
// JavaScript-Variablen, UI-/Export-/Admin-Begriffe. \`keywordIndex.test.ts\`
// akzeptiert jedes "code-förmige" Index-Label, das entweder in ALL_KEYWORDS
// (Grammar) oder hier steht. Ein neues Handbuch-Keyword lässt den Test
// fehlschlagen → in die Grammar aufnehmen ODER hier eintragen.

export const KEYWORD_INDEX_IGNORE: readonly string[] = [
`;

function main() {
	const write = process.argv.includes('--write');
	const kw = grammarKeywords();
	const current = fs
		.readFileSync(FIXTURE, 'utf8')
		.match(/'([^']+)'/g)
		.map((s) => s.slice(1, -1));

	const codeShaped = indexLabels()
		.filter((l) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(l))
		.map((l) => l.toLowerCase());
	const inIndex = new Set(codeShaped);

	const next = [
		...new Set(codeShaped.filter((l) => !kw.has(l))),
	].sort();

	const added = next.filter((k) => !current.includes(k));
	const removed = current.filter((k) => !next.includes(k));
	const nowKeyword = current.filter((k) => kw.has(k));
	const gone = current.filter((k) => !inIndex.has(k) && !kw.has(k));

	console.log(`ignore entries: ${current.length} -> ${next.length}`);
	console.log(`\nnew non-keyword labels (added to ignore list): ${added.length}`);
	added.forEach((k) => console.log(`  + ${k}`));
	console.log(`\nlabels now promoted to grammar keywords (dropped): ${nowKeyword.length}`);
	nowKeyword.forEach((k) => console.log(`  ~ ${k}`));
	console.log(`\nlabels no longer in the index (dropped): ${gone.length}`);
	gone.forEach((k) => console.log(`  - ${k}`));
	console.log(
		'\n⚠ Prüfe die "added"-Liste: gehört ein Eintrag in die Grammar statt hierher?',
	);

	if (!write) {
		console.log('\ndry run – re-run with --write to apply');
		return;
	}
	const body = next.map((k) => `\t'${k}',`).join('\n');
	fs.writeFileSync(FIXTURE, HEADER + body + '\n];\n', 'utf8');
	console.log(`\nwrote ${FIXTURE} – run \`npx prettier --write\` on it`);
	void removed;
}

main();
