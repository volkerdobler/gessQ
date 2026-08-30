# Change Log

All notable changes to the "GESS Q." extension will be documented in this file.
Current version number is first:

### Unreleased

- Symbol name grammar is now context-sensitive: definition sites require a
  letter-initial name, reference sites also accept a leading `_` so the
  built-in system variables (`_finished`, `_caseid`, …) stay navigable
  ("Find References", highlight, hover). Names – quoted or bare – must obey
  the identifier grammar; umlauts, `$`, spaces and `.` no longer produce
  broken regexes.
- `compute NAME =`, `textarray NAME =`, `textelement NAME`,
  `intrandom NAME =` and `databaseConnection NAME =` are now indexed as
  variable definitions, so Go to Definition, Find All References, Rename,
  hover and the symbol outline pick them up (`textarray` alongside arrays,
  the others alongside opennumformats).
- Find All References for an `opennumformat` now also finds its uses in
  NumQ / GNumQ / SliderQ labels (`… format NAME`).
- Hover on `single` in `single = yes|no;` now shows the Group single-choice
  attribute instead of the (unrelated) exclusive-answer label attribute.
- Hover rework:
  - on the name in its own definition: nothing (hover the command keyword,
    e.g. `singleq`, for its documentation);
  - on a language keyword: the glossary entry as before;
  - on a reference to a question / variable: name, kind, definition
    location, and the command's short description + handbook link. New
    setting **`gessq.hover.referenceDetail`** (`off` / `summary` /
    `definition` / `full`, default `summary`) adds, from `definition` up, an
    **excerpt of the definition** – the `singleq` line plus `text` / `title`
    / `labels` / `flt` / `assert` …, up to the next definition. `definition`
    leaves out `actionblock` (incl. multi-line brace blocks), `javascript`
    and `css`; `full` keeps everything. The excerpt now tolerates a single
    blank line between attribute groups (two end it).
- `language-configuration.json`: `wordPattern` aligned with the parser
  grammar; `onEnterRules` use the `indent` action key (the previous
  `indentAction` key was silently ignored, so auto-indent/outdent on Enter
  did nothing).
- `#ifdef` / `#ifndef` / `#else` / `#endif` are the preprocessor's, so they
  are now highlighted as directives even inside strings and inside embedded
  html / javascript / css. Folding of `#ifdef … #endif` inside a string
  already worked and is now covered by a test.

### 0.99.0 — 2026-08-29

Interner Testbuild (nur als `.vsix`, nicht über den Marketplace). Bündelt die
gesamte Überarbeitung (siehe `HISTORY.md`) für den Praxistest.

- Thymeleaf rendering support: `rendering` / `renderClass` / `thymeleaf` are
  highlighted and explained on hover (links to the rendering docs);
  `html` / `thymeleaf` are offered as completions after `rendering =`; a
  diagnostic warns when `rendering =` is set more than once or after the
  first question definition.
- The extension's display name is now **GESS Q.** (was "gessQ") – shown in the
  Marketplace, the settings section, the Output channel and diagnostic
  sources. Config keys (`gessq.*`), the language id and the grammar scope are
  unchanged.
- Lowered the minimum VS Code version to **1.85.0** (`engines.vscode` and
  `@types/vscode` pinned in sync); the extension only uses APIs available
  since 1.45, and 1.85 is the first release shipping Node 18 (matching the
  esbuild `node18` target).
- CI now also publishes to **Open VSX** (VSCodium, Cursor, Windsurf, Gitpod,
  code-server) alongside the VS Code Marketplace. One-time setup: claim the
  Open VSX namespace and add an `OVSX_PAT` repo secret.
- New `keywordIndex.test.ts` guard: every code-shaped label in the committed
  handbook keyword index must be a grammar keyword or listed in the baseline
  ignore file — a handbook refresh that adds a keyword now fails CI until it
  is triaged. `tools/gen-keyword-ignore.js` regenerates the baseline.
- Decided the glossary stays **bundled-only** (no `gessq.glossary.source`
  online option); the `detail` links already point to the live handbook.
- `array` / `vararray` declarations (`array NAME [n];`, `array NAME = […];`,
  `vararray NAME = ( … );`) are now indexed as variable definitions, so Go to
  Definition, Find All References, Rename, hover and the symbol outline pick
  them up – e.g. alongside a `group` of the same name.
- `quotavar NAME = ( <condition> );` is indexed as a quota-variable
  definition, so Go to Definition / Find All References / Rename resolve
  `NAME`.
- Hovering the name on its own definition line no longer shows the
  "defined here" hover – the line is already visible.
- New settings `gessq.hover.enable` and `gessq.codeLens.enable` (both
  default `true`): turn off the GESS Q. hover entirely, or hide the
  "N references" CodeLens.
- Glossary hover / completion docs now show a one-line `syntax` hint and a
  short German `summary` on top of the handbook link (rendered: heading,
  syntax block, summary, link). **Every glossary entry** is filled in, and
  **every keyword the extension highlights now has a hover** (892 entries) –
  this adds the frequently-hovered `text` / `title` / `labels` / `export` /
  `format` / `sortid` attributes, the `sq`/`mq`/`sgq`… type short forms, the
  `sys_*` internal-variable aliases and the graphical-button / `ki_*` / class
  parameters that were missing before. A `glossary.test.ts` check keeps the
  keyword list and the glossary in sync.
- `manualGlossary.json` now covers every keyword of the handbook index (61
  added, incl. `sl_*` / `pg_*` slider & packaging params and template CSS
  classes). New `tools/sync-glossary.js` does a non-destructive re-sync;
  the old overwrite-everything generators were removed.

New language features (Phase 5):

- Diagnostics: unbalanced `{}` / `()`, unmatched `#macro`/`#endmacro` and
  `#ifdef`/`#endif`, missing `#include` files, duplicate names in a file and
  unknown `#domacro` targets. Toggle with `gessq.diagnostics.enable`.
- `#include "…"` paths are clickable links.
- Rename (F2) for questions, opennumformats, blocks/screens, macros and
  action targets, across the workspace.
- Hover on a workspace symbol shows where it is defined plus a code preview.
- CodeLens "N references" above every definition; occurrences of the symbol
  under the cursor are highlighted.
- Experimental "Format Document": re-indents by `{`/`(` nesting depth.
- New settings: `gessq.diagnostics.enable`,
  `gessq.completion.includeWorkspaceSymbols`, `gessq.files.exclude`.
- Grammar: HTML is highlighted inside `html=` / `text=` / `title=` and the
  `htmlPre*` / `write*` text blocks.

Completion (Phase 5.2):

- Context-aware: after `#`/`@` only preprocessor directives, after `&` or
  `#domacro ` only macro names, otherwise keywords plus workspace symbols.
- Workspace symbol names (questions, blocks, macros, opennumformats, action
  targets) are offered with a per-kind icon.
- Highlighting a keyword now shows its glossary description; symbol entries
  show where they are defined.

Language core (Phase 4):

- New workspace symbol index (`src/core/symbolIndex.ts`): a single scan via
  `findFiles` kept current with a file-system watcher. Go to Definition, Find
  All References and Go to Symbol in Workspace query the index instead of
  re-reading every `.q` file on each request.
- Go to Definition / Find All References now return the precise range of the
  name, not the whole line; all navigation providers honour cancellation.
- Parser fixes: `#macro NAME` is recognised (previously the regex could never
  match, and expected the wrong `#macro #NAME` form); `load(/set(` targets;
  multiple spaces after a question keyword; the generic patterns are memoised.
- Completion keywords come from `src/data/language.ts`, generated from the
  grammar (`npm run gen:language`), instead of scraping the grammar at
  runtime; completion also offers workspace symbol names and is suppressed
  in comments/strings.
- "Go to Symbol in Workspace" now lists only real definitions.

Restructure (Phase 3):

- Source tree reorganised: `src/core` (parser, scope, symbol search),
  `src/providers` (one file per language feature), `src/infra` (logger, fs,
  vscode helpers), `src/data` (glossary); grammar and snippets moved to
  `language/`. `extension.ts` is now just activation + registration.
- Single scope implementation. The scanner is a proper state machine and now
  honours backslash escapes, so `\"` no longer ends a double-quoted string.
- Logger gains a `gessq.logLevel` setting (`off`/`error`/`warn`/`info`/
  `debug`); `gessq.debugMode` stays as a deprecated alias.
- Removed the process-wide `unhandledRejection` listener.
- "Go to Symbol in Workspace" now waits for all files before returning
  results instead of resolving after the first file.

Build & resources (Phase 2):

- Bundle with esbuild (`esbuild.js`); `tsc` is now type-check only.
- Single async glossary loader (`src/commons/glossary.ts`) resolved via
  `context.extensionUri` and `vscode.workspace.fs`; hover, signature help and
  keyword completion no longer depend on shipping `src/` – signature help now
  actually finds the glossary.
- `.vscodeignore` added: the .vsix now contains only the bundle, assets and
  language files (9 files, ~37 KB).
- ESLint flat config (`eslint.config.js`); modernised `tsconfig`.
- Unit tests for the parser regex factories and for the JSON/grammar/snippet
  assets; `package-lock.json` is committed; GitHub Actions CI.

Fixes (Phase 1):

- Grammar path in `package.json` corrected to lowercase `gessq.tmLanguage.json`
  (broke case-sensitive builds / Marketplace).
- `language-configuration.json` rewritten as valid JSON – comment toggling,
  auto-indent, `wordPattern` and `onEnterRules` now take effect.
- Snippets: removed invalid `scope` field, multi-prefixes converted to arrays,
  stray newlines in prefixes/keys removed, CRLF bodies normalised to `\n`.
- Grammar: fixed `silderq` typo, corrected `\\.` escape patterns in strings,
  removed a bogus match that blocked embedded `source.js`, added `gnumq` /
  `passwdq` to the core question keywords.
- Removed dead code from `extension.ts` and unused imports.
- Removed stale compiled test artifact; unit tests run again via a `vscode`
  mock.
- README updated to describe the actual feature set and settings.

### 0.3.9

Improve number recognition
Insert new commands for new rendering

### 0.3.8

Insert new script function-names to syntax

### 0.3.7

new snippet file (thanks to all GESSGROUP programmers!)

### 0.3.6

Minor bug fix in 0.3.5

### 0.3.5

New Syntax file - thanks to Sebastian Zagaria from GessGroup
Update npm packages

### 0.3.4

Insert new feature: working with folding regions

Bug fix in finding a variable definition

### 0.3.3

Bug fixes: [Issue02](https://github.com/volkerdobler/gessQ/issues/2#issue-1126976954) & [Issue03](https://github.com/volkerdobler/gessQ/issues/3#issue-1126994849)
Thanks to [@dietzste](https://github.com/dietzste)

### 0.3.2

Bug fix: [Issue01](https://github.com/volkerdobler/gessQ/issues/1#issue-1087885595)
Double-Quotes preceded with a Backslash will no longer recognized as start of a string.

Update: insert new commands in language file

### 0.3.1

Update: insert new command "JsonDataLimit" in language file

### 0.3.0

Update: new order of SymbolProviders

### 0.2.5

Bug fix: WorkspaceSymbolProvider did not work correctly.

### 0.2.4

Bug fix: wrong regexp in actionBlockRe

### 0.2.3

Bug fix: minimum length of variable names had been 2. Reduced to 1

### 0.2.2

Bug fix: Word boundary in getWordDefinition did not work with quotations.

### 0.2.1

Bug fix of block comment chars
Bug fix in getWordDefinition to include word boundaries

### 0.2.0

New scope identification - now comments and strings are much better recognized to identify variable definitions or references

### 0.1.8

Bugfix to work with project manager and subdirectories

### 0.1.7

Bugfix in snippets - preAssertionActionBlock was wrong spelled

### 0.1.6

Added opennumformat to find symbols definition or references

### 0.1.5

Fixed a bug that references are found case insensitive

### 0.1.4

Fixed a bug to identify comments correctly.

### 0.1.3

Another bug fix in Find all References.

### 0.1.2

Bug fixes in Definition Provider and Find all References.
Also minor optimizations for Go to symbol

### 0.1.1

First version of "Go to symbol" (CTRL-T)
Not working correctly for all possibilities of references (especially assert are
not handle allways correctly). But it will find most of the references which
are used in all scripts in the directory - including sub-directories.

### 0.1.0

Add "Find all References" and update to new version

### 0.0.19

Add GESS Q. icon from www.gessgroup.de

### 0.0.18

Goto Definition Provider (F12) is looking in all files in workspace/(sub-)folder

### 0.0.17

add Goto Definition Provider (F12)

### 0.0.16

fixed an error in language-configuration.json
ShowLabelValues is now also highlighted as reserved word

### 0.0.15

just a minor test - same as version 0.0.13

### 0.0.14

no changes

### 0.0.13

New snippet check_grid_open (only valid with our GN macro)

### 0.0.12

"group" is now recognized as variable which can be found while using the symbol search function
Closing Symbol includes now comments starting with "/\*"

### 0.0.11

while rewriting the symbols in version 0.0.10, some easy symbols got wrong - fixed

### 0.0.10

rewrite of symbol search to show only real questions and screens/blocks - will be extended to other commands in the future

### 0.0.9

optimize symbol search

### 0.0.8

colorization of some GESS Q. commands have been added

### 0.0.7

further optimization of syntax highlighting

### 0.0.6

Optimize syntax highlighting

### 0.0.5

The Question-Keywords are now recognized case insensitive

### 0.0.4

Fixed an error with the "Find all Reference" function

### 0.0.3

Changed search-String to find only question-names and no block, screen or opennumformat statements

### 0.0.2

Changed the description slightly.

### 0.0.1

Initial release of a first version. Feedback is very welcomed.
