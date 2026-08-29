# Historie – GESS Q. VS Code Extension

Abgeschlossene Analyse, Umbau (Phase 1–5) und der Entscheidungslog.
**Offene Punkte stehen in [TODO.md](TODO.md).**

Ausgangs-Analyse-Stand: 2026-08-28, analysierte Version `0.3.9`. Die
Abschnitte 1–7 beschreiben den **damaligen** Zustand und den geplanten Umbau;
Abschnitt 8 die tatsächliche Umsetzung, Abschnitt 9 die getroffenen
Entscheidungen.

Gewählte Ausbaustufe (abgestimmt):

- **Pragmatisch erweitern** – Bugs beheben + gezielte Features im heutigen
  Architekturstil (kein Language Server).
- **Zielstruktur mit konkretem Baum** wird vorgeschlagen.
- **Build:** Umstieg auf `esbuild`, JSON-/Grammar-Assets per Build-Schritt
  bündeln, `.vscodeignore` ergänzen.

Legende: 🔴 kritisch · 🟠 Bug/Korrektur · 🟡 Optimierung · 🟢 Erweiterung

---

## 1. Kurzbewertung

Die Extension ist funktional aufgebaut (Grammar, Snippets, Symbol-/Definition-/
Reference-/Folding-/Completion-/Hover-/Signature-Provider). Die Kernprobleme:

1. Mehrere **Ressourcen werden im gepackten VSIX nicht gefunden** (Glossar,
   Grammar-Pfad, Case-Sensitivität) – Hover/Signature/Completion arbeiten
   deshalb im Blindflug bzw. nur mit Fallback-Listen.
2. `language-configuration.json` ist **kein gültiges JSON** → Klammer-/Kommentar-/
   Einrück-Konfiguration wird von VS Code verworfen.
3. **Doppelte Logik** (zwei Scope-Implementierungen, zwei Glossar-Loader) und
   **toter Code** in `extension.ts`.
4. **Snippets**: `scope`-Feld falsch, Multi-Prefix als Komma-String,
   `\r\n`-Literale und Zeilenumbrüche in Prefixen.
5. Provider **rescannen bei jedem Aufruf den gesamten Workspace** synchron,
   ohne Cache und ohne `CancellationToken`.

---

## 2. 🔴 Kritische Fehler (zwingend korrigieren)

### 2.1 Grammar-Pfad mit falscher Groß-/Kleinschreibung

- `package.json`: `"path": "./syntaxes/gessQ.tmLanguage.json"`
- Datei auf Platte: `syntaxes/gessq.tmLanguage.json` (klein).
- Unter Windows (case-insensitive) funktioniert es zufällig, auf Linux/CI und im
  Marketplace-Build **bricht das Grammar-Laden**.
- **Fix:** einen Namen festlegen (Vorschlag: `gessq.tmLanguage.json`) und in
  `package.json`, `completionComponent.ts` und Build-Skripten konsistent nutzen.

### 2.2 `language-configuration.json` ist ungültiges JSON

Konkrete Syntaxfehler in [language-configuration.json](language-configuration.json):

- Fehlendes Komma nach dem `surroundingPairs`-Array (vor `"indentationRules"`).
- `wordPattern`: `"(-?\\d*\\.\\d\w*)"` – `\w` ist kein gültiger JSON-Escape,
  `\.` ebenso nicht durchgehend escaped.
- `indentationRules` / `onEnterRules`: Werte enthalten `\{`, `\s`, `\b`
  (ungültige JSON-Escapes), z. B.
  `"increaseIndentPattern": "^.*(\{\s*$|\b(block|screen|if|for|foreach)\b.*(=|\().*)"`.
- `autoCloseBefore` enthält doppelte `\t\t`.

**Folge:** VS Code kann die Datei nicht parsen und fällt auf Defaults zurück –
Kommentar-Toggle (`Strg+/`), Auto-Indent, `onEnterRules` und `wordPattern`
greifen nicht.

**Fix:** Datei neu als valides JSON schreiben, alle Regex-Backslashes doppeln
(`\\{`, `\\s`, `\\b`, `\\d`, `\\w`), Kommas ergänzen. Danach mit
`JSON.parse`/Schema testen. `wordPattern` sollte Umlaute + `$` enthalten:
`"([A-Za-zÄÖÜäöüß_$][A-Za-zÄÖÜäöüß0-9_$]*)"`.

### 2.3 `manualGlossary.json` wird nicht mitgeliefert / nicht gefunden

- `tsc` kopiert **keine** JSON-Dateien nach `out/`. In `out/` liegt kein
  `manualGlossary.json`.
- [hoverProvider.ts](src/components/hoverProvider.ts) findet es nur über
  `contextPath/src/commons/manualGlossary.json` (funktioniert im Dev-Host,
  im VSIX nur zufällig, weil ohne `.vscodeignore` `src/` mitgepackt wird).
- [signatureProvider.ts](src/components/signatureProvider.ts) sucht **andere**
  Pfade (`__dirname/../commons`, `contextPath/commons`) → findet die Datei
  **nie** → Signature-Help arbeitet immer nur mit Heuristik.
- **Fix:**
    1. Build-Schritt: `manualGlossary.json` (+ `syntaxes/`, `snippets/`,
       `language-configuration.json`) nach `out/` kopieren bzw. via `esbuild`
       als Asset einbinden.
    2. **Einen** gemeinsamen Glossar-Loader (`src/data/glossary.ts`), der den
       Pfad relativ zu `context.extensionUri` auflöst und `vscode.workspace.fs`
       nutzt (async, kein `fs.readFileSync`).
    3. `extensionPath` an alle Provider konsistent übergeben (Hover bekommt ihn,
       Signature ebenfalls – aktuell nur teilweise).

### 2.4 Completion findet die Grammar-Datei nie

[completionComponent.ts](src/components/completionComponent.ts):

```ts
path.join(__dirname, '..', 'syntaxes', 'gessq.tmLanguage.json');
```

Zur Laufzeit ist `__dirname = out/components`, also wird
`out/syntaxes/...` gesucht – existiert nicht. Es greift **immer** die
hartkodierte Fallback-Liste.

- **Fix:** Pfad über `context.extensionUri` auflösen; Keyword-Liste besser aus
  einer gepflegten Datendatei (siehe 5.1) statt per Regex-Scraping aus der
  Grammar erzeugen.

---

## 3. 🟠 Bugs / Korrekturen

### 3.1 Snippets ([snippets/snippets.json](snippets/snippets.json))

- **`scope`-Feld falsch:** `"scope": "source.gessQ"` – das Snippet-`scope`
  erwartet **Sprach-IDs** (`"gessq"`), keinen TextMate-Scope. Da die Snippets
  ohnehin über `contributes.snippets` an `language: gessq` gebunden sind:
  `scope` überall **entfernen**.
- **Multi-Prefix als Komma-String:** `"prefix": "iAB, initActionBlock"` wird als
  _ein_ Prefix `"iAB, initActionBlock"` interpretiert. VS Code unterstützt
  Arrays: `"prefix": ["iAB", "initActionBlock"]`. Alle betroffenen Snippets
  umstellen.
- **Zeilenumbruch im Prefix:** `"prefix": "check_grid_open\r\n"`,
  `"check_open\r\n"` – der `\r\n` gehört entfernt.
- **`\r\n`-Literale in Bodies:** durchgängig auf `\n` umstellen oder Array-Form
  (`"body": [ "...", "..." ]`) verwenden – `\r\n` kann sichtbare `^M` erzeugen.
- **`\\;` in Bodies:** in Snippets muss `}` nicht escaped werden, aber `\\}`
  wurde genutzt, um Tabstop-Ende `${2:...}` von Literal `}` zu trennen – nach
  Umbau auf Array-Form prüfen, ob noch nötig.
- **Leere `description`:** viele Snippets haben `"description": ""` – kurze
  deutsche Beschreibung ergänzen (bessere IntelliSense-Anzeige).
- Doppelte/überlappende Keys prüfen (`iAB, initActionBlock` existiert mehrfach in
  Varianten).

### 3.2 `extension.ts` – toter Code / Aufräumen

- `GessQCompletionProviderLocal` (ungenutzt).
- `macroDefRe`-Wrapper, `getWordDefinition`, `constTokenVarNameRest`,
  `getWordAtPosition`-Import teils ungenutzt.
- `import * as fs` / `import * as path` – nur `path` wird real gebraucht.
- `getScopeAt`, `getCachedScope`, `isCommentAt`, `isStringAt`, `Scope`,
  `ScopeEnum`, `cacheDebug` werden importiert, aber nicht alle verwendet.
- `provideDefinition` ruft `resolve()` in einer `forEach`-Schleife mehrfach auf
  (nur der erste zählt) – auf „ersten Treffer, dann abbrechen“ umstellen.

### 3.3 Definition/Reference-Provider

- **Ergebnis-Range zu grob:** es wird `line.range` (ganze Zeile) als Location
  zurückgegeben statt des Wort-Ranges → „Go to Definition“ springt an
  Zeilenanfang, „Peek“ markiert die ganze Zeile.
- **`token: CancellationToken` wird ignoriert** – bei großen Workspaces keine
  Abbruchmöglichkeit.
- **Kein Schutz gegen fehlendes Verzeichnis:** `getAllFilenamesInDirectory`
  ruft ungeschützt `fs.readdirSync` – bei Untitled-Docs / ohne Workspace kann
  das werfen. In `try/catch` bzw. `vscode.workspace.findFiles` umstellen.
- **`getAllFilenamesInDirectory(wsFolder, '(q)')`** im WorkspaceSymbolProvider:
  inkonsistenter Parameter (`'(q)'` vs. `'q'`). Vereinheitlichen.
- `fixDriveCasingInWindows` nutzt das veraltete `String.prototype.substr`.

### 3.4 Grammar ([syntaxes/gessq.tmLanguage.json](syntaxes/gessq.tmLanguage.json))

- **Tippfehler:** `silderq` und `sliderq` beide in der ersten Keyword-Regel –
  `silderq` entfernen.
- **Escape-Bug:** In den String-/Blockkommentar-Pattern steht
  `"match": "\\."` mit `name: constant.character.escape` bzw.
  `comment.block` → `\.` matcht **jedes** Zeichen, nicht `\`+Zeichen.
  Korrekt: `"match": "\\\\."` (Backslash + Zeichen).
- **`[^#]include`** taucht mitten in einer `\b(...|...)\b`-Alternation der
  `support.class`-Regel auf – dort semantisch falsch platziert.
- Fragetyp `gnumq` (GNumQ, Handbuch 3.9) fehlt in der ersten Keyword-Regel;
  `passwdq` ist nur in der großen `support.class`-Liste, nicht bei den
  Kern-Fragetypen.
- Die riesige Einzel-Alternation (hunderte Wörter in einer Regel) ist schwer
  wartbar → in `repository`-Abschnitte aufteilen, generiert aus einer
  Datendatei (siehe 5.1).

### 3.5 `package.json`

- `engines.vscode` vs. `@types/vscode` – angleichen (erledigt: beide `1.85.0`,
  siehe §9.1)
  (z. B. beide auf `^1.90.0`, je nach gewünschter Mindestversion).
- Kein `activationEvents` nötig (wird aus `contributes.languages` abgeleitet) –
  ok, aber explizit `"activationEvents": []` schadet nicht zur Klarheit.
- Fehlt: `.vscodeignore` (siehe 6) → VSIX enthält aktuell `src/`,
  Tool-Skripte, `dokumentation/` teils, Maps.
- `scripts.test` = `jest`, aber `launch.json` „Extension Tests“ zeigt auf
  `out/test` (existiert nicht). Test-Setup vereinheitlichen.
- Ergänzen: `keywords`, `bugs`, `homepage`, `qna`, ggf. `badges`.
- `categories`: „Programming Languages“, „Snippets“ ok; ggf. „Formatters“,
  „Linters“ nach Ausbau.

### 3.6 `out/`-Verzeichnis

- Enthält Alt-Artefakte (`out/src/**`, `out/scope.js`, `out/__tests__/**`) aus
  einer früheren `rootDir`-Konfiguration.
- `out` ist via `.gitignore` (Next.js-Block) ignoriert – ok, aber lokal einmal
  `out/` löschen und Clean-Build prüfen. `npm run compile` sollte `rimraf out`
  als Vorstufe bekommen.

### 3.7 Stale Testdatei

- `__tests__/scope.test.js` (+ `.map`) im Repo-Root ist ein kompiliertes
  Alt-Artefakt und referenziert `../src/scope` (existiert nicht mehr).
- **Fix:** löschen. Tests leben in `src/__tests__/*.test.ts`.
- `.gitignore` enthält `__tests__/scope.test.js.map`, aber nicht die `.js` –
  Eintrag bereinigen bzw. Datei entfernen.

### 3.8 Doku

- `README.md` sagt „Currently, no settings are supported“ – falsch, es gibt
  `gessq.debugMode`. Aktualisieren, Feature-Liste (Hover, Signature, Folding,
  Completion) ergänzen.
- `dokumentation/gess-q-handbuch.md` ist ein PDF-Export mit kaputtem Encoding
  (`f�r` statt `für`) und ohne Markdown-Überschriften → als Glossar-/
  Hover-Quelle unbrauchbar. Entweder sauber neu konvertieren oder klar als
  „nur Referenz, nicht maschinell genutzt“ kennzeichnen.

---

## 4. 🟡 Optimierungen (Code & Performance)

### 4.1 Nur eine Scope-Implementierung

Aktuell parallel:

- `Scope` (Klasse, `scopeComponent.ts`) – zeichenweises Array, respektiert
  konfigurierbare Delimiter, wird via Cache genutzt.
- `getScopeAt` (Funktion, gleiche Datei) – eigenständige, inkrementelle
  Variante, **ohne** konfigurierbare Delimiter, rescannt ab Zeile 0 bei jedem
  Aufruf.

→ Risiko divergierenden Verhaltens. **Vorschlag:** `getScopeAt` löschen,
überall `getCachedScope(document).getScope(line, ch)` verwenden. Cache-Keys
zusätzlich per `onDidCloseTextDocument` aufräumen (passiert bereits) und
Größenlimit einführen.

### 4.2 Workspace-Symbol-Index statt Rescan

Definition-, Reference- und WorkspaceSymbol-Provider öffnen bei **jedem Aufruf**
alle `.q`-Dateien und scannen Zeile für Zeile mit ~8 Regex/Zeile.

- **Vorschlag:** `SymbolIndex`-Klasse:
    - Initialer Scan über `vscode.workspace.findFiles('**/*.q', excludeGlob)`.
    - Ergebnis (Fragen, Blöcke, Makros, Definitionen, Labels) je Datei cachen.
    - `FileSystemWatcher` (`onDidChange/Create/Delete`) für inkrementelle Updates.
    - Provider fragen nur noch den Index ab → O(1)/O(log n) statt O(Dateien·Zeilen).
- `CancellationToken` in allen Providern auswerten.

### 4.3 Regex-Fabriken (`parserUtils.ts`)

- Regexe pro Aufruf neu kompiliert – für die parameterlosen Varianten
  (`questionDefRe('')` etc.) einmalig memoisieren.
- `actionBlockDefRe`: `'\\b(load|set)\\b\\s*\\(?:\\s*...'` – `\(?:` ist
  vermutlich als `(?:` **oder** `\(` gemeint; aktuell matcht es `(` optional
  gefolgt von `?:` literal. Bug im Regex, prüfen und korrigieren.
- Einheitliche Nutzung von `constVarName` vs. `getWordDefinition` (teils
  redundant).
- Unit-Tests für jede Regex-Fabrik (positive + negative Fälle) ergänzen.

### 4.4 Logger

- `info()`/`warn()` sind hinter `debugMode` versteckt → die Aktivierungs-
  Meldung erscheint nie. `warn`/`error` sollten unabhängig vom Flag ins
  Output-Channel gehen; `debug`/`info` nur bei `debugMode`.
- `LogLevel`-Enum + `setLevel()` statt boolean.
- `console.*`-Fallback entfernen (im Extension-Host unnötig).

### 4.5 `process.on('unhandledRejection', …)` in `activate()`

Globaler Prozess-Listener betrifft **alle** Extensions im selben Host.
Besser: einzelne `Promise`-Ketten mit `.catch(logError)` absichern; den
globalen Listener entfernen (wird zwar per `dispose` abgemeldet, ist aber
riskant und maskiert Fehler anderer Extensions).

### 4.6 `getWordAtPosition`

- Rückgabe-Tuple `[boolean, string, Position]` – 3. Element wird kaum genutzt.
  In `{ found, word, range }` umbenennen (lesbarer).
- Fallback „bis zu 3 Zeichen nach links“ ist heuristisch; besser das
  `wordPattern` aus der Language-Config über `getWordRangeAtPosition(pos, re)`
  nutzen.

### 4.7 Async statt sync I/O

`fs.readFileSync` / `fs.readdirSync` / `fs.existsSync` blockieren den
Extension-Host. Auf `vscode.workspace.fs` bzw. `fs/promises` umstellen.

### 4.8 TypeScript-Strenge

- `tsconfig`: `target` auf `ES2021`, `lib` entsprechend; `moduleResolution:
"node16"` o. ä.
- `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters` aktivieren
  (`.eslintrc` schaltet `no-unused-vars` aktuell komplett aus – zu lax).
- Viele `any` (`results.forEach((r: any) …)`) durch echte Typen ersetzen
  (`PromiseSettledResult<T>`).

### 4.9 ESLint / Prettier

- `.eslintrc.js` nutzt `"prettier/@typescript-eslint"` – **veraltet/entfernt**
  in aktuellen Versionen von `eslint-config-prettier`. Auf Flat-Config
  (`eslint.config.js`) migrieren, nur noch `eslint-config-prettier` am Ende.
- `@typescript-eslint/ban-ts-ignore`, `camelcase` – umbenannt/entfernt in v8.
  Regelset an installierte v8 anpassen.

---

## 5. 🟢 Erweiterungen (sinnvoll & umsetzbar)

### 5.1 Zentrale Sprach-Datendatei

Eine gepflegte `src/data/language.json` mit:
`{ name, kind (fragetyp|parameter|funktion|direktive), aliases, signatur,
kurzbeschreibung, doc-url }`.
Daraus generiert/gespeist:

- Grammar-Keyword-Listen (Build-Script erzeugt die `match`-Alternationen),
- Completion-Items inkl. Doku & `CompletionItemKind`,
- Hover-Texte (statt nur Link),
- Signature-Help-Parameterlisten.
  → Beseitigt die Doppelpflege Grammar/Fallback/Glossar.

### 5.2 Completion aufwerten

- **Scope-aware:** in Kommentar/String keine Vorschläge.
- **Dynamische Symbole:** Fragenamen, Makronamen, Block-/Screen-Namen,
  `opennumformat`-Namen, Label-IDs aus Datei + Workspace-Index.
- **Kontextabhängig:** nach `#` nur Präprozessor-Direktiven, nach `#domacro `
  Makronamen, innerhalb `labels=` andere Vorschläge.
- Snippet-Vorschläge mit einbinden (`CompletionItemKind.Snippet`).
- Doku (`documentation: MarkdownString`) aus 5.1/Glossar.

### 5.3 Diagnostics / Linter (light)

`DiagnosticCollection`, aktualisiert bei `onDidChangeTextDocument` (debounced):

- Unbalancierte `{` / `};`.
- `#macro` ohne `#endmacro`, `#ifdef`/`#ifndef` ohne `#endif`.
- `#domacro` auf unbekanntes Makro.
- Doppelte Frage-/Block-Namen im selben Scope.
- `#include`-Datei existiert nicht.
- Optional: fehlendes `;` am Statement-Ende (heuristisch, per Setting
  abschaltbar).

### 5.4 DocumentLinkProvider für `#include`

`#include "datei.q"` / `#includeifexists "…"` klickbar machen → öffnet die
Datei (relative Pfadauflösung zum aktuellen Dokument bzw. Workspace).

### 5.5 Hover für Benutzer-Symbole

Wenn das Wort ein im Index bekanntes Symbol ist: Definition-Datei + Zeile +
Code-Vorschau (erste Zeilen) im Hover zeigen, zusätzlich zum Glossar-Eintrag.

### 5.6 Rename-Provider

`vscode.RenameProvider` für Fragen/Makros/Blöcke workspace-weit (nutzt den
Index aus 4.2). Mit `prepareRename` zur Absicherung.

### 5.7 CodeLens / DocumentHighlight

- CodeLens „N Referenzen“ über Fragen-/Block-Definitionen.
- `DocumentHighlightProvider` (markiert Vorkommen des Symbols unter Cursor).

### 5.8 Formatter (später)

`DocumentFormattingEditProvider`: Einrückung an `{ … };`-Blöcken,
konsistente Leerzeichen um `=`. Zunächst konservativ / opt-in.

### 5.9 Konfiguration erweitern

Neue Settings unter `gessq.*`:

- `gessq.logLevel` (`off|error|info|debug`) statt `debugMode`.
- `gessq.files.exclude` (Glob-Liste für Index-Scan, z. B. `**/backup/**`).
- `gessq.diagnostics.enable` / einzelne Regeln.
- ~~`gessq.glossary.source` (`bundled|online`) + `gessq.glossary.baseUrl`~~ –
  verworfen (§9.7: nur gebündelt).
- `gessq.completion.includeWorkspaceSymbols` (bool).

### 5.10 Grammar: eingebettete Sprachen

`javascript=`/`jsHandler=`/`css=` werden schon eingebettet – zusätzlich
`html`-Blöcke und mehrzeilige Textblöcke (`text="…"`, `title="…"`) sauber als
`string`/`text.html` markieren.

### 5.11 Tests

- `parserUtils`-Regex-Suite.
- Provider-Tests via `@vscode/test-electron` (echte Extension-Host-Tests) für
  Definition/Reference/Symbols.
- Grammar-Snapshot-Tests mit `vscode-tmgrammar-test`.
- `language-configuration.json` + `snippets.json` + `manualGlossary.json` per
  Test gegen `JSON.parse` / JSON-Schema validieren (hätte 2.2 verhindert).

### 5.12 CI/CD

GitHub Actions: `lint` → `compile` → `test` → `vsce package`; Release-Job
`vsce publish` bei Tag. `ovsx publish` für Open VSX optional.

---

## 6. Zielstruktur der Dateien

Prinzipien: klare Trennung _Aktivierung / Provider / Sprachkern (Parser,
Scope, Index) / Infrastruktur / Daten_. Einheitliche Benennung `*Provider.ts`.
`components/` + `commons/` entfallen.

```
gessq/
├── package.json
├── .vscodeignore                 # NEU – VSIX schlank halten
├── esbuild.js                    # NEU – Bundling + Asset-Copy
├── eslint.config.js              # Flat-Config (ersetzt .eslintrc.js)
├── tsconfig.json
├── language-configuration.json   # als valides JSON neu
├── CHANGELOG.md
├── README.md
│
├── language/                     # deklarative Sprachdefinition
│   ├── gessq.tmLanguage.json     # einheitliche Kleinschreibung
│   └── snippets.json
│
├── src/
│   ├── extension.ts              # nur activate/deactivate + Registrierung
│   │
│   ├── providers/
│   │   ├── completionProvider.ts
│   │   ├── hoverProvider.ts
│   │   ├── signatureProvider.ts
│   │   ├── definitionProvider.ts
│   │   ├── referenceProvider.ts
│   │   ├── documentSymbolProvider.ts
│   │   ├── workspaceSymbolProvider.ts
│   │   ├── foldingRangeProvider.ts
│   │   ├── documentLinkProvider.ts     # NEU (#include)
│   │   ├── renameProvider.ts           # NEU
│   │   └── diagnostics.ts              # NEU (Linter)
│   │
│   ├── core/
│   │   ├── scope.ts             # EINE Scope-Implementierung (+ Cache)
│   │   ├── parser.ts            # Regex-Fabriken (ex parserUtils)
│   │   ├── symbolIndex.ts       # NEU – Workspace-Index + FileWatcher
│   │   └── types.ts
│   │
│   ├── data/
│   │   ├── language.json        # NEU – zentrale Keyword-/Signatur-Daten
│   │   ├── manualGlossary.json  # (bleibt, wird gebündelt)
│   │   └── glossary.ts          # EIN Loader (async, extensionUri-basiert)
│   │
│   ├── infra/
│   │   ├── logger.ts
│   │   ├── fsUtils.ts
│   │   └── vscodeUtils.ts
│   │
│   └── test/
│       ├── unit/                # jest: parser, scope, glossary
│       │   ├── parser.test.ts
│       │   └── scope.test.ts
│       ├── grammar/             # vscode-tmgrammar-test
│       └── integration/         # @vscode/test-electron
│
├── tools/                        # Glossar-Generatoren (Node-Skripte, console.* ok)
│   └── …
│
├── dokumentation/               # Referenz (nicht im VSIX)
└── out/                          # Build-Output (gitignored, rimraf vor Build)
```

Migration in kleinen Schritten:

1. `commons/` → `infra/` + `core/` (reine Umbenennung, Imports anpassen).
2. `components/` → `providers/` + `core/scope.ts` + `data/glossary.ts`.
3. `parserUtils.ts` → `core/parser.ts`.
4. `syntaxes/` + `snippets/` → `language/`, Pfade in `package.json`.
5. Barrel-Datei `components/index.ts` entfernen oder durch `providers/index.ts`
   ersetzen.

---

## 7. Build / Tooling (esbuild + Asset-Bündelung)

1. **`esbuild.js`**: Entry `src/extension.ts` → `out/extension.js`
   (`--bundle --platform=node --external:vscode --format=cjs`), Watch-Modus
   für Dev.
2. **Asset-Copy** im selben Skript: `language/*.json`,
   `src/data/*.json` → `out/` (bzw. `out/data/`). Provider laden Assets
   ausschließlich relativ zu `context.extensionUri`.
3. **`.vscodeignore`**: `src/`, `tools/`, `dokumentation/`, `out/**/*.map`,
   `**/*.ts`, `.github/`, Test-Ordner, `previousVersions/`, `manual/`
   ausschließen.
4. **`package.json` scripts**:
    ```jsonc
    "vscode:prepublish": "npm run check && node esbuild.js --production",
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "check": "tsc --noEmit && eslint src --ext ts",
    "test": "jest",
    "test:integration": "node ./out/test/integration/runTest.js",
    "package": "vsce package"
    ```
5. `tsc` nur noch für Typcheck (`--noEmit`), Transpile macht esbuild.
6. `rimraf out` als Pre-Build.

---

## 8. Priorisierte Roadmap

### Phase 1 – Korrekturen (blocker, klein) ✅ erledigt

- [x] 2.1 Grammar-Dateiname vereinheitlichen (Kleinschreibung).
- [x] 2.2 `language-configuration.json` als valides JSON neu schreiben + Test.
- [x] 3.1 Snippets: `scope` raus, Multi-Prefix als Array, `\r\n` bereinigen
      (Bodies zusätzlich auf `\n` normalisiert, Keys bereinigt).
- [x] 3.4 Grammar: `silderq`-Typo, `\\.`-Escape-Bug, `gnumq`/`passwdq` ergänzt,
      bogus `source.js`-blockierendes Match entfernt.
- [x] 3.7 Stale `__tests__/scope.test.js` gelöscht; jest via `vscode`-Mock
      wieder lauffähig (`moduleNameMapper`); `src/__tests__` aus `tsc` exkludiert.
- [x] 3.2 Toten Code in `extension.ts` entfernt (`getWordDefinition`,
      `GessQCompletionProviderLocal`, lokaler `macroDefRe`, ungenutzte Importe).
- [x] 3.8 README aktualisiert.

### Phase 2 – Ressourcen & Build ✅ erledigt

- [x] 2.3 / 2.4 Gemeinsamer async Glossar-Loader
      (`src/commons/glossary.ts`, `vscode.workspace.fs`, Pfade über
      `context.extensionUri`); Hover + Signature nutzen ihn, Completion lädt
      die Grammar ebenfalls über `extensionUri`. Signature-Help fand das
      Glossar bisher nie – jetzt behoben.
- [x]   7. `esbuild.js` (Bundle + Asset-Copy von `manualGlossary.json` nach
       `out/`), `.vscodeignore` (VSIX: 9 Dateien, 37 KB, kein `src/`),
       `main` → `out/extension.js`, `npm run package` getestet.
- [x] 4.9 ESLint Flat-Config (`eslint.config.js`, `typescript-eslint`
      Meta-Paket, `.eslintrc.js` entfernt); `tsconfig` modernisiert
      (ES2021, `esModuleInterop`, `forceConsistentCasingInFileNames`,
      `noImplicitReturns`); `tsc --noEmit` nur noch Typecheck.
      Restliche Lint-_Warnungen_ (ungenutzte `token`-Parameter etc.) in
      Phase 3.
- [x] 5.11 `parser.test.ts` (Regex-Fabriken, inkl. `test.failing` für den
      `macroDefRe`-Bug → 4.3) und `assets.test.ts` (JSON/JSONC-Validierung,
      Snippet-`scope`/Prefix-Regeln, Grammar-`scopeName`, case-sensitive
      Contribution-Pfade). 25 Tests grün.
- [x] 5.12 `.github/workflows/ci.yml`: install → check → test → build →
      `vsce package` (+ Artifact); `publish`-Job bei `v*`-Tag
      (`secrets.VSCE_PAT`).
- [x] Zusatz: `package.json` `keywords`/`bugs`/`homepage`, `@types/vscode`
      an `engines` angeglichen (jetzt `1.85.0` / `^1.85.0`, siehe §9.1),
      `typescript` als devDependency; `package-lock.json` wird jetzt committet
      (reproduzierbares `npm ci`).

### Phase 3 – Umstrukturierung ✅ erledigt

- [x]   6. Ordner-/Dateistruktur migriert:
       `commons/` → `infra/` (logger, fsUtils, vscodeUtils) + `core/`
       (parser, scope, symbolSearch); `components/` → `providers/`;
       `syntaxes/` + `snippets/` → `language/`; Glossar nach `src/data/`.
       Die Inline-Provider aus `extension.ts` (Definition, Reference,
       DocumentSymbol, WorkspaceSymbol, FoldingRange) sind jetzt eigene
       Dateien in `providers/` mit Barrel `providers/index.ts`.
       `extension.ts` ist auf ~110 Zeilen geschrumpft (nur `activate` /
       `deactivate` + Registrierung) und hat jetzt ein `deactivate`.
       Abweichungen vom Zielbaum: Tests bleiben in `src/__tests__/`
       (jest-idiomatisch, kein Config-Churn) statt `src/test/unit/`;
       `core/scopeDelimiters.ts` entfiel (Delimiter in `scope.ts` inlined).
- [x] 4.1 Eine Scope-Implementierung: `getScopeAt` gelöscht, `Scope`-Klasse
      als State-Machine mit Backslash-Escape-Handling neu geschrieben
      (behebt: `\"` beendete einen String fälschlich nicht → jetzt korrekt);
      alle `isNotInCommentAt`/`isCommentAt`/`isStringAt` laufen über den
      Cache. `scope.test.ts` deckt Escapes, mehrzeilige Strings/Blöcke und
      Out-of-range ab.
- [x] 4.4 Logger mit `LogLevel` (`off|error|warn|info|debug`), gespeist aus
      neuem Setting `gessq.logLevel`; `gessq.debugMode` bleibt als
      deprecated Fallback. `onDidChangeConfiguration` aktualisiert live.
- [x] 4.5 Globaler `process.on('unhandledRejection')`-Listener aus
      `activate()` entfernt.
- [x] Nebenbei: `WorkspaceSymbolProvider` löste bisher nach der _ersten_
      Datei auf (racy, unvollständig) – jetzt `Promise.allSettled` über
      alle Dateien. Restliche Lint-Warnungen (ungenutzte `token`-Parameter,
      totes `constVarToList`) beseitigt → `npm run check` 0 Warnings.

### Phase 4 – Sprachkern ✅ erledigt

- [x] 4.2 `src/core/symbolIndex.ts`: `SymbolIndex` scannt einmalig via
      `workspace.findFiles('**/*.q')` und hält sich mit einem
      `FileSystemWatcher` (create/change/delete) + `onDidChangeWorkspaceFolders`
      aktuell. Definition-, Reference- und WorkspaceSymbol-Provider fragen
      jetzt den Index ab statt bei jedem Aufruf alle Dateien rekursiv zu
      lesen. `parseDocumentSymbols()` ist wiederverwendbar (Provider parsen
      zusätzlich das aktuelle – ggf. ungespeicherte – Dokument frisch).
- [x] 3.3 Definition/Reference geben jetzt **präzise Wort-Ranges** zurück
      (nicht mehr die ganze Zeile); alle vier Provider werten den
      `CancellationToken` aus. DocumentSymbol nutzt `DocumentSymbol` mit
      `selectionRange` auf dem Namen.
- [x] 5.1 `src/data/language.ts` (generiert von `tools/gen-language.js` aus
      der Grammar, `npm run gen:language`, CI prüft Sync) ist die einzige
      Keyword-Quelle für Completion – kein Laufzeit-Scraping der Grammar
      mehr. Die Grammar bleibt handgepflegte Source of Truth; das Rück-
      Generieren der Grammar aus Daten (inkl. Signatur/Doku pro Keyword)
      bleibt für später offen.
- [x] 4.3 Parser-Fixes: `macroDefRe` (Wortgrenzen-Bug **und** falsche
      Syntax `#macro #Name` → korrekt `#macro Name`, siehe Handbuch §2.4),
      `actionBlockDefRe` (`\(?:`-Bug), `questionDefRe`/`definitionDefRe`
      `\s`→`\s+` (mehrere Leerzeichen), Memoisierung der parameterlosen
      Varianten, neues `actionDefRe`. Tests entsprechend erweitert; der
      frühere `test.failing` ist jetzt ein echter Test.
- [x] Verhaltensänderung: „Go to Symbol in Workspace“ liefert nur noch
      echte Definitionen (Frage/Definition/Block/Makro/Action-Target), nicht
      mehr check/assert-Vorkommen.

### Phase 5 – Neue Features

- [x] 5.2 Completion aufgewertet: - scope-aware (in Kommentar/String keine Vorschläge) – bereits Phase 4; - **kontextabhängig**: nach `#` nur `#`-Direktiven, nach `@` nur
      `@`-Direktiven, nach `&` bzw. `#domacro ` nur Makronamen, sonst
      Keywords + Workspace-Symbole (`detectContext`, unit-getestet); - **dynamische Symbole** aus dem `SymbolIndex` (Fragen, Blöcke, Makros,
      opennumformat, Action-Targets) mit `CompletionItemKind` je Kategorie; - **Doku**: `resolveCompletionItem` hängt lazy den Glossar-Eintrag als
      `MarkdownString` an; Symbol-Items zeigen `keyword – datei:zeile`.
      Offen: Label-IDs als Vorschläge, `labels=`-Kontext, sowie das
      explizite Einmischen der Snippets (VS Code liefert `contributes.snippets`
      ohnehin automatisch in dieselbe Liste).
- [x] 5.4 `GessQDocumentLinkProvider`: der Pfad in `#include "…"` /
      `#includeifexists "…"` ist klickbar (Auflösung relativ zum Dokument),
      `src/core/includes.ts` als geteilter Parser.
- [x] 5.3 Diagnostics (`src/core/diagnostics.ts` + `providers/diagnostics.ts`,
      debounced, per `gessq.diagnostics.enable` abschaltbar): unbalancierte
      `{}` / `()` (scope-aware), `#macro`/`#endmacro` und `#ifdef`/`#endif`
      unbalanciert, fehlende `#include`-Datei, doppelte Namen im selben File,
      unbekanntes `#domacro`-Ziel. „Fehlendes `;`“ bewusst weggelassen
      (zu heuristisch).
- [x] 5.5 Hover zeigt für Workspace-Symbole Definitionsort + Code-Vorschau,
      zusätzlich zum Glossar-Eintrag.
- [x] 5.5a Hover auch für `support.class.gessQ`-Tokens – durch 5.5c erledigt:
      `manualGlossary.json` (892 Einträge) deckt jetzt **jedes von der
      Extension gehighlightete Schlüsselwort** ab (alle Index-Keywords plus
      `text`/`title`/`labels`/`export`/`format`/`sortid`, die Kurzformen
      `sq`/`mq`/`sgq`…, die `sys_*`-Aliase, `button_*`/`ki_*`/`*class`).
      `glossary.test.ts` hält `language.ts` und Glossar synchron. Auf der
      Definitionszeile bleibt der Hover wie bei Variablen unterdrückt (5.5).
- [x] 5.5b Vollständigkeit gegen den Schlüsselwort-Index – erledigt via
      `tools/sync-glossary.js` (non-destruktiver Merge, siehe 5.5c). Der
      lokale Index (`tools/index.html`) wurde aufgefrischt, 61 fehlende
      Keywords ergänzt, ein Junk-Key `""` entfernt. Die alten,
      alles-überschreibenden Generatoren (`index2glossary.js`,
      `index_local2glossary.js`, `checkAnchors.js`) sind gelöscht.
      `glossary.test.ts` erzwingt jetzt in CI: jedes `language.ts`-Keyword hat
      einen Glossar-Eintrag mit `summary`. Offen bleibt nur die Gegenrichtung
      (Grammar ↔ Schlüsselwort-Index, §9 Punkt B).
- [x] 5.5c `manualGlossary.json` inhaltlich aufwerten: `GlossaryEntry` um
      optionale `syntax` + `summary` erweitert; `hoverProvider` und
      `completionProvider` rendern via `formatEntryMarkdown` (Header = `short`,
      dann `syntax` als ```gessq```-Block, dann `summary`, zuletzt der
      `detail`-Link; Fallback wenn die Felder fehlen). `assets.test.ts` prüft
      das Schema (alle Einträge, einzeilige `syntax`, https-Handbuch-URL),
      `glossary.test.ts` das Rendering.
      **Alle 760 Einträge haben jetzt eine `summary`** (552 zusätzlich eine
      `syntax`-Zeile), handgeschrieben aus den Handbuch-Seiten (curl mit
      Browser-User-Agent, kein Voll-Scrape). Regel für die Zukunft:
      bestehende `short`/`syntax`/`summary` nicht anfassen, `detail` nur bei
      echtem Seitenumzug; neue Befehle per `node tools/sync-glossary.js`
      (~1–2 Jahre) ergänzen und dann von Hand `syntax`/`summary` nachtragen.
      `tools/sync-glossary.js` schreibt Tab-Einrückung (Prettier-konform).
- [x] 5.6 `GessQRenameProvider` (workspace-weit, mit `prepareRename` –
      nur für bekannte Symbole; validiert den neuen Namen). `#macro`-Defs
      und `&name`/`#domacro name`-Aufrufe sind jetzt in der Referenzsuche.
- [x] 5.7 `GessQDocumentHighlightProvider` (Vorkommen unter Cursor,
      Definition als Write) + `GessQCodeLensProvider` („N references“ über
      jeder Definition, lazy via `resolveCodeLens`).
- [x] 5.9 Neue Settings: `gessq.diagnostics.enable`,
      `gessq.completion.includeWorkspaceSymbols`, `gessq.files.exclude`
      (fließt in den Index-Scan; Index baut bei Änderung neu).
      `gessq.logLevel` bereits Phase 3.
- [x] 5.8 `GessQFormattingProvider` (Document + Range): konservative
      Re-Einrückung nach `{`/`(`-Tiefe (scope-aware), nur führender
      Whitespace, Kommentar-/String-Fortsetzungszeilen unangetastet.
      Bewusst simpel → nur auf manuelles „Format Document“.
- [x] 5.10 Grammar: `text.html.basic` in `html=`/`text=`/`title=`/
      `htmlPre*`/`write*`/`errorPre*Text`-Blöcken eingebettet.
- [x] 5.14 Thymeleaf-Rendering (GESS Q. ≥ 4.3.0): ab `rendering =
      html | thymeleaf;` (globaler Befehl, einmalig vor der ersten
      Fragedefinition) rendert der Server aus HTML-Templates statt aus
      `template.html`; `renderClass = "NAME";` wählt je Frage ein
      spezialisiertes Template. Skriptseitig umgesetzt:
      - Glossar `rendering` / `renderclass` korrigiert (waren geratene
        Batch-I-Einträge), neuer Eintrag `thymeleaf`; `detail` → Rendering-Doku
        <https://help.gessgroup.de/rendering/>. Diese drei stehen **nicht** im
        q-help-Index und werden von Hand gepflegt (Vermerk in
        `tools/README.md`).
      - Grammar: `thymeleaf` als `support.constant` ergänzt; `language.ts`
        regeneriert.
      - Completion: nach `rendering =` → `html` / `thymeleaf`
        (`detectContext` → `renderingValue`).
      - Diagnostics: `checkRendering` warnt bei mehrfachem `rendering =` bzw.
        `rendering =` nach der ersten Fragedefinition.
      - README aktualisiert. `component` (auch ein Batch-I-Rateeintrag) bleibt
        vage – kein Beleg gefunden.
      Die Template-Seite (`.html`, Thymeleaf/JEXL) erzeugt der Q.-Server
      (Java) – kein `.q`, damit **nichts für die Extension**.
- [ ] 5.13 Echte Sprachfeatures in eingebetteten JS-/CSS-Blöcken → **offen,
      siehe [TODO.md](TODO.md)**.

Offene Reste (→ [TODO.md](TODO.md)): 5.2 (Label-IDs / `labels=`-Kontext),
5.11 (Integrations-/Grammar-Snapshot-Tests).

---

## 9. Entscheidungen

1. **Mindest-VS-Code-Version** (`engines.vscode`) – **`^1.85.0`** (Nov 2023).
   Rein API-seitig würde 1.45 reichen (neueste genutzte API: `Uri.joinPath`),
   aber `esbuild` baut mit `target: node18` und 1.85 ist die erste Version mit
   Node 18, die keine Build-Änderung erzwingt. `package.json` `engines.vscode`
   und `@types/vscode` (exakt `1.85.0`) angepasst; `tsc` gegen die 1.85-API grün.
3. **Linter „fehlendes `;`“** – **bewusst nicht umgesetzt** (5.3), es gibt
   dazu **keine** Einstellung. GESS Q. hat mehrzeilige Statements, `};`-Blöcke
   und eingebettete HTML-/JS-Bereiche → `;`-Erkennung produziert zu viele
   Fehlalarme. *Nur als Idee, falls die Entscheidung je gekippt wird:* ein
   opt-in-Setting (Arbeitstitel `gessq.diagnostics.missingSemicolon`, Default
   **off**), das nur eindeutige Fälle prüft (`keyword = "…"` / `Fragetyp NAME`
   ohne `;`, nicht in Block/String/Kommentar). Aktuell nicht geplant.
5. **Handbuch-Quelle für Hover-Texte** – **erledigt** (5.5c). Kein sauberer
   Export nötig/verfügbar; die Handbuch-Seiten werden direkt geladen
   (`curl` mit Browser-User-Agent), Text von Hand auf 1–3 Sätze + Syntaxzeile
   gekürzt. Prozess dokumentiert in `tools/README.md` / `tools/sync-glossary.js`.
6. **Vollständige Schlüsselwortliste** – der offizielle Schlüsselwort-Index
   <https://help.gessgroup.de/q-help/hmkwindex.html> ist die Quelle;
   `tools/sync-glossary.js` zieht daraus, `glossary.test.ts` erzwingt, dass
   jedes `language.ts`-Keyword einen Glossar-Eintrag hat (läuft in CI).
   `language.ts` selbst wird aus der Grammar generiert (`gen:language`,
   CI-Sync-Check). GNumQ & Co. sind vollständig abgedeckt.
7. **Glossar online vs. gebündelt** (war §9.2) – **entschieden: A1, nur
   gebündelt.** Kein `gessq.glossary.source`, kein Netzwerkcode/`baseUrl`,
   keine CSP-/Proxy-/Hosting-Themen. Alle 892 Einträge liegen handkuratiert
   offline vor, `detail` verlinkt aufs Live-Handbuch, Auffrischung ~1–2 Jahre
   via `sync-glossary.js`. `gessq.glossary.source` aus der 5.9-Settingliste
   gestrichen.
8. **`language.ts`/Grammar ↔ Schlüsselwort-Index** (war §9.6-Rest) –
   **entschieden: B1.** Test `keywordIndex.test.ts` (läuft in CI): jedes
   „code-förmige“ Label aus `tools/index.html` muss in `ALL_KEYWORDS` **oder**
   in der Baseline-Ignore-Liste (`src/__tests__/fixtures/
   keyword-index-ignore.json`) stehen. Die Ignore-Liste enthält die heute
   bekannten Nicht-Grammar-Einträge (Abschnittsüberschriften, `qonline.cfg`-
   Parameter, CSS-Klassen, Template-JS-Variablen, UI-/Export-Begriffe). Bei
   einem Handbuch-Update (`sync-glossary.js`) prüft der failende Test: neuer
   Eintrag → in die Grammar oder in die Ignore-Liste.
9. **Publikation: VS Marketplace + Open VSX** (war §9.4) – **entschieden: C1.**
   CI-`publish`-Job veröffentlicht zusätzlich auf Open VSX
   (`npx ovsx publish gessq.vsix --pat $OVSX_PAT`), `ovsx` als devDependency.
   **Einmalige manuelle Einrichtung nötig:** eclipse.org-Account anlegen,
   Namespace beanspruchen
   (`npx ovsx create-namespace volkerdobler -p <token>`), Token als
   Repo-Secret `OVSX_PAT` hinterlegen. Erreicht VSCodium, Cursor, Windsurf,
   Gitpod, code-server. Einmalige manuelle Einrichtung offen → [TODO.md](TODO.md).

Zurückgestellte Entscheidung: **`language.json` als Single Source** (B2) →
[TODO.md](TODO.md).
