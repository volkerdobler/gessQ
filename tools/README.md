# tools/

Maintenance scripts. None of these run at build time – run them by hand when
the underlying source (the handbook, the grammar) changes.

## sync-glossary.js — keep `src/data/manualGlossary.json` in sync with the handbook

`manualGlossary.json` feeds the hover / completion documentation. Every command
from the GESS Q. keyword index should have an entry; entries may additionally
carry a hand-written `syntax` hint and a shortened `summary` (see HISTORY.md 5.5c).

Run every year or two:

1. Refresh the local copy of the keyword index (needs a browser User-Agent):

   ```bash
   curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
     https://help.gessgroup.de/q-help/hmkwindex.html -o tools/index.html
   ```

2. Dry run — prints what it would add / change:

   ```bash
   node tools/sync-glossary.js
   ```

3. Apply:

   ```bash
   node tools/sync-glossary.js --write
   ```

The sync is **non-destructive**: it only *adds* missing keywords (as
`{ short, detail }`) and refreshes a `detail` URL when the handbook moved the
page. `short`, `syntax` and `summary` of existing entries are never touched.
After a sync, fill in `syntax` / `summary` for the new keywords by hand.

**Hand-maintained entries** (not in the keyword index, so `sync-glossary.js`
never touches them – keep them current manually from their own docs):
`rendering`, `renderclass`, `thymeleaf` → <https://help.gessgroup.de/rendering/>.

4. Regenerate the keyword-index baseline for `keywordIndex.test.ts`:

   ```bash
   node tools/gen-keyword-ignore.js          # dry run
   node tools/gen-keyword-ignore.js --write
   npx prettier --write src/__tests__/fixtures/keywordIndexIgnore.ts
   ```

## gen-keyword-ignore.js — baseline of index labels that are NOT grammar keywords

Feeds `src/__tests__/keywordIndex.test.ts` (HISTORY.md §9.8): every "code-shaped"
label in `tools/index.html` must be either a grammar keyword (`ALL_KEYWORDS`)
or in this list (section titles, `qonline.cfg` params, CSS classes, template
JS vars, UI/export terms). After a handbook refresh the test fails on any new
label — decide per label whether it belongs in the **grammar** or the ignore
list, then rerun this script with `--write`. Its dry run prints new labels
plus a reminder to check whether they are actually keywords.

## gen-language.js — regenerate `src/data/language.ts` from the grammar

```bash
npm run gen:language
```

## testHover.js — quick glossary lookup probe

```bash
node tools/testHover.js
```

## pdf2glossary.js — one-off PDF → glossary extraction (historical)

Superseded by `sync-glossary.js`; kept for reference.
