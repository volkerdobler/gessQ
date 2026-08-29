# TODO – GESS Q. VS Code Extension

Nur offene Punkte. Abgeschlossene Arbeit, die Ausgangs-Analyse und der
Entscheidungslog stehen in [HISTORY.md](HISTORY.md).

---

## Features

### 5.13 Echte Sprachfeatures in eingebetteten JS-/CSS-Blöcken

Hover, Completion und Signaturhilfe für `javascript="…";` / `jsHandler="…";`
**und** `css="…";`. Die TextMate-Einbettung (`meta.embedded.block.javascript`
/ `.css`, `include: source.js|source.css`) macht nur die Färbung – der JS/TS-
bzw. CSS-Sprachdienst läuft in Fremdsprach-Bereichen nicht.

Lösung: **Request-Forwarding über ein virtuelles Dokument** (wie VS Code bei
`<script>`/`<style>` in HTML):

- `TextDocumentContentProvider` mit eigenem Schema (`gessq-embedded-js:` /
  `gessq-embedded-css:`); Inhalt = `.q`-Text, alles außer den JS- bzw.
  CSS-Regionen durch Whitespace ersetzt (gleiche Länge → Positionen bleiben
  1:1); virtueller Pfad `.js`/`.css`.
- **`@insert(...)` (auch `@insert[...]` / `@insert{...}`) sowie `&macroname;`
  innerhalb der Region im virtuellen Doc ausblenden** – durch gleich lange
  Platzhalter (Leerzeichen bzw. eine neutrale Kennung wie `_i_`, damit der
  JS-Parser einen Identifier sieht statt eines Syntaxfehlers). Zeilenumbrüche
  erhalten.
- Region-Scanner (`src/core/embeddedRegions.ts`), erkennt
  `javascript=`/`jsHandler=` bzw. `css=` … `";` (kann `getCachedScope`
  mitnutzen); mehrere Regionen pro Datei möglich.
- Eigener Hover-/Completion-/Signature-Provider: liegt die Position in einer
  Region → `vscode.commands.executeCommand('vscode.executeHoverProvider' |
  '…CompletionItemProvider' | '…SignatureHelpProvider', virtualUri, position)`
  und Ergebnis durchreichen. Diagnostics vorerst nicht weiterreichen.
- **`globals.d.ts` mitliefern** (im VSIX gebündelt) mit ambient-Decls für die
  im GESS Q.-Kontext verfügbaren Globals: `QDot` (inkl. `QDot.onSubmit`,
  `QDot.logger`, `QDot.clickranking`, `QDot.heatplotter`, `QDot.keyboard`),
  `$`/`jQuery`, `Android`, `startBackgroundAudioRecording`,
  `stopAudioRecording`, `openBarcodeScanner`, `hideq`, `insertLayer`,
  `addImage` … – per `/// <reference>` bzw.
  `jsconfig`/`typeAcquisition`-Mechanik an die virtuellen Docs hängen. Datei
  pflegbar halten (Kommentar: Quelle = Handbuch-Kapitel 17/26/16).
- Optional `contributes.grammars[].embeddedLanguages` setzen (bessere
  Klammer-/Kommentar-/Einrücklogik im Block – ersetzt die Weiterleitung aber
  nicht).
- Aufwand ~200–300 Zeilen + `globals.d.ts`; Extension-Host-Tests
  (`@vscode/test-electron`) nötig, da Jest das nicht abdeckt.

### 5.2-Reste – Completion

- Label-IDs (Antwortcodes einer Frage) als Vorschläge.
- `labels=`-Kontext: innerhalb der Labelliste andere Vorschläge.

### 5.11-Reste – Tests

- Provider-/Integrationstests via `@vscode/test-electron` (echte
  Extension-Host-Tests) für Definition/Reference/Symbols/Hover.
- Grammar-Snapshot-Tests mit `vscode-tmgrammar-test`.

---

## Offene Entscheidung

### B2 – `language.json` als Single Source

Eine gepflegte Datendatei generiert Grammar-Keyword-Listen + Completion-Items
+ Hover-Texte + Signaturhilfe-Parameter aus einer Quelle (statt Grammar
handgepflegt und Glossar separat). Großer Umbau, aktuell rein kosmetisch – alles
funktioniert. Zurückgestellt; Alternativen B1 (umgesetzt) / B3 siehe
[HISTORY.md](HISTORY.md) §9.8.

---

## Einmalig / manuell

- **Open VSX freischalten** (der CI-Schritt existiert bereits, siehe
  [HISTORY.md](HISTORY.md) §9.9): eclipse.org-Account anlegen, Namespace
  beanspruchen (`npx ovsx create-namespace volkerdobler -p <token>`), Token
  als Repo-Secret `OVSX_PAT` hinterlegen.

---

## Wiederkehrende Wartung

- **Glossar-Abgleich (~alle 1–2 Jahre)** – Details in
  [tools/README.md](tools/README.md):
    1. `tools/index.html` neu aus dem Schlüsselwort-Index speichern (curl mit
       Browser-User-Agent).
    2. `node tools/sync-glossary.js` (dry run) → `--write`.
    3. `syntax` / `summary` der neuen Einträge von Hand nachtragen
       (bestehende Einträge nicht anfassen, `detail` nur bei Seitenumzug).
    4. `node tools/gen-keyword-ignore.js` (dry run) → `--write`; neue
       „code-förmige“ Labels prüfen: Grammar oder Ignore-Liste?
    5. `npx prettier --write src/data/manualGlossary.json
       src/__tests__/fixtures/keywordIndexIgnore.ts` → `npm test`.
- **Nach Grammar-Änderungen** `npm run gen:language` (CI prüft den Sync von
  `src/data/language.ts`).
