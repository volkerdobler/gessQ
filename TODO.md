# TODO – GESS Q. VS Code Extension

Abgeschlossene Arbeit, die Ausgangs-Analyse und der Entscheidungslog stehen in
[HISTORY.md](HISTORY.md).

---

## Improvements oder Bugs

- **Referenz-Hover: `text`/`title`/`labels` der Variable mit anzeigen**
  (Nutzerwunsch, 2026-09-09). **Pausiert (2026-09-09):** Nutzer prüft erst
  selbst, ob die bestehende Stufe `definition` von `gessq.hover.referenceDetail`
  das schon leistet – `definitionExcerpt` (`hoverProvider.ts`) übernimmt bei
  `definition`/`full` bereits alle nicht per `EXCERPT_OMIT` gefilterten
  Roh-Zeilen der Definition, und `EXCERPT_OMIT` filtert nur
  `actionblock`/`javascript`/`jshandler`/`css`-Attribute heraus – `text`,
  `title` und `labels` sind also (sofern vorhanden) schon Teil des
  `definition`-Auszugs, nur eben als roher Quelltext-Ausschnitt statt als
  normalisierte `Text="…"`/`Title="…"`/`Labels=…;`-Zeilen, und zusammen mit
  allen anderen nicht gefilterten Attributen (nicht nur den dreien). Nur die
  Standardstufe `summary` zeigt sie nicht. Falls nach der Prüfung noch
  Bedarf besteht: Ursprünglicher Plan war, gezielt nur diese drei Attribute
  aus der Definition herauszuparsen und normalisiert auszugeben – offene
  Frage dabei, ob das `summary` direkt anreichert oder eine neue Zwischenstufe
  wird (Nutzer-Vorgabe für Minimal/Maximal: nur Link ↔ Link +
  `Text="…"` + `Title="…"` + `Labels=…;`, jedes Element weglassen wenn an der
  Definition nicht gesetzt).
- **✅ Umgesetzt (2026-09-09, mit Nutzer verfeinert):** Auto-Vervollständigung
  nur bei explizitem Ctrl+Space (statt bei jedem Tastendruck) – Ctrl+Space
  funktioniert dabei immer, unabhängig vom Setting. Zwei Teile: 1)
  `package.json` `contributes.configurationDefaults["[gessq]"]` setzt
  `editor.quickSuggestions: false` als Default für GESS-Q-Dateien
  (Standard-VS-Code-Mechanismus, vom Nutzer selbst pro Sprache
  überschreibbar). 2) `gessq.completion.autoTrigger` – ursprünglich als
  Boolean umgesetzt, auf Nutzerwunsch zu einem dreistufigen Enum verfeinert:
  `off` (Default – nur Ctrl+Space, auch `#`/`@`/`&`/Leerzeichen lösen nichts
  aus), `trigger` (zusätzlich `#`/`@`/`&`, aber **kein** Leerzeichen) und
  `full` (zusätzlich auch Leerzeichen, z.B. in `labels=`-Listen). Reine
  Entscheidungsfunktion `autoTriggerAllows(context)` (exportiert aus
  `completionProvider.ts`) prüft `context.triggerKind`/`triggerCharacter`
  gegen `completionAutoTrigger()` (`src/infra/config.ts`); ein `Invoke` oder
  `TriggerForIncompleteCompletions` lässt immer durch. Getestet in
  `src/__tests__/completion.test.ts` (Entscheidungsfunktion isoliert plus
  Provider-Verdrahtung).
- **✅ Umgesetzt (2026-09-09):** Formatter-Fix für `labels=`/`group( … )`
  (mit Nutzer abgestimmte Variante: nur den Listen-Inhalt von der
  Einrückung ausnehmen, Klammer-Tiefen-Logik für alles andere unverändert
  lassen – **nicht** die volle Umstellung auf Keyword-basierte Tiefe wie bei
  gesstabs, da `{` in GESS Q. echte Actionblock-/JS-/CSS-Codeblöcke markiert,
  deren Einrückung sonst verloren ginge). `GessQFormattingProvider.format`
  (`src/providers/formattingProvider.ts`) verfolgt jetzt zusätzlich, ob eine
  Zeile innerhalb einer `labels=`/`gridlabels=`/`griditems=`-Liste liegt
  (`LIST_START`, jetzt aus `completionProvider.ts` exportiert und hier
  wiederverwendet): deren Inhalt (inkl. `group( … )`) bleibt bei der
  Einrückung unangetastet (nur Trailing-Whitespace wird dort noch getrimmt),
  die `labels=`-Zeile selbst bekommt weiter normale Einrückung, und die
  Klammertiefe wird auch innerhalb der Liste weitergezählt, damit
  nachfolgender Code wieder korrekt eingerückt wird. **Kein neuer
  Config-Schalter** (mit Nutzer abgestimmt: „Format Document" ist schon ein
  expliziter Aufruf, das genügt als Opt-in). Getestet in neuem
  `src/__tests__/formattingProvider.test.ts` (7 Fälle, inkl. Regression für
  die bestehende Klammer-Einrückung und Range-Formatting).

## Vergleich mit gesstabs-Extension (Analyse 2026-09-09)

Auslöser: Verdacht, gessq reagiere nicht zuverlässig auf Settings-Änderungen
(zur Laufzeit, ohne Extension-Reload), im Gegensatz zu gesstabs. Zwei
Recherche-Durchgänge über beide Codebasen ergaben:

**Settings-Reaktivität – Fehlalarm, aber ein struktureller Unterschied bleibt.**
Alle `gessq.*`-Settings werden bereits live gelesen (`src/infra/config.ts`
cacht nichts) und wirken ohne Reload – geprüft wurden `diagnostics.enable`
(eigener Listener in `diagnostics.ts:41-45`), `hover.enable`/
`hover.referenceDetail` (pro Hover-Request neu gelesen), `codeLens.definitions`
(`extension.ts:70-72` löst `onDidChangeCodeLenses` aus),
`completion.includeWorkspaceSymbols`, `embeddedLanguages.enable`,
`files.exclude` (`extension.ts:67-69` stößt `index.rebuild()` an) und
`logLevel`/`debugMode`. Einzige Ausnahme: `releaseNotes.showOnUpdate` wird nur
einmal bei `activate()` geprüft – das ist by design (Feature hat ohnehin
keinen Live-Trigger innerhalb einer Session), kein Bug.
  Unterschied zu gesstabs: dort bündelt `extension.ts:257-269` die
  Invalidierung in **einem zentralen** `onDidChangeConfiguration`-Dispatcher,
  der pro Setting gezielt `manager.invalidate()` aufruft.
  **✅ Umgesetzt (2026-09-09):** gessq zieht jetzt denselben zentralen
  Dispatcher – `DiagnosticsManager` registriert keinen eigenen
  `onDidChangeConfiguration`-Listener mehr, sondern stellt ein öffentliches
  `refreshOpen()` bereit, das der eine Dispatcher in `extension.ts` bei
  `gessq.diagnostics`-Änderungen aufruft (neben Log/Index/CodeLens).

**Formatter** – ✅ umgesetzt, siehe oben unter „Improvements oder Bugs".

**Vorgemerkte Muster/Utilities aus gesstabs (aktuell kein akuter Bedarf, aber
fertig zum Kopieren falls der Bedarf entsteht):**

- `gesstabs/src/util/glob.ts` – kleine `globToRegExp`/`matchesAnyPattern`-
  Funktion (Basename-Wildcards `*`/`?`, case-insensitive), ~15 Zeilen. gessq
  reicht `gessq.files.exclude` aktuell direkt als Glob-String an
  `vscode.workspace.findFiles` durch (funktioniert) – relevant nur, falls
  gessq mal eigenes Basename-Pattern-Matching braucht (z.B. ein künftiges
  „welche Dateien gehören zum Projekt"-Setting).
- `gesstabs/src/util/lru.ts` – TTL-LRU-Cache. Kein Bedarf, solange teure
  Datei-Scans über den `SymbolIndex` laufen (der hat bereits Watcher +
  Debounce). Nur falls künftig teure Scans *außerhalb* des SymbolIndex
  entstehen.
- `gesstabs/src/providers/externalNamesProvider.ts` – Architekturmuster (pro
  Workspace-Ordner ein `FileSystemWatcher` + In-Flight-Dedupe-Map +
  `invalidate()` bei Config-Änderung + Cache keyed by mtime/size). Kein
  direktes Ziel in gessq heute, aber Vorlage falls gessq mal externe
  Abhängigkeiten bekommt (z.B. ein Äquivalent zu mehreren Einstiegsskripten
  statt dem festen `script.q`-Root, oder externe JSON-Schemas).

**Bereits gleichwertig oder besser in gessq – kein Handlungsbedarf:** der
`SymbolIndex` (gessq hat einen `FileSystemWatcher`, das gesstabs-Pendant
gleichen Namens nicht), das Include-Handling (`src/core/includes.ts` +
`projectFiles.ts` deckt das gessq-`#include`-Modell inkl. Zyklenerkennung
bereits ab – gesstabs' `includeGraph.ts`/`macroExpansion.ts` sind nur
aufwändiger, weil sie zusätzlich einen `#ifdef`/`#define`-Makro-Präprozessor
auflösen, den GESS Q. nicht hat).

## Offene Entscheidung

### B2 – `language.json` als Single Source

Eine gepflegte Datendatei generiert Grammar-Keyword-Listen, Completion-Items,
Hover-Texte und Signaturhilfe-Parameter aus **einer** Quelle (statt Grammar
handgepflegt und Glossar separat). Großer Umbau, aktuell rein kosmetisch – alles
funktioniert. Zurückgestellt; Alternativen B1 (umgesetzt) / B3 siehe
[HISTORY.md](HISTORY.md) §9.8.

### B3 – Granularere Hover-Settings (aus gesstabs-Vergleich, 2026-09-09)

gesstabs zerlegt Hover in mehrere Settings (`hover.macros`, `hover.expands`,
`hover.keywords`, `hover.variables`, `hover.variableAnnotations`,
`hover.macroExpansionStyle`), jeweils mit eigenem Guard im Provider. gessq
hatte nur `hover.enable` (an/aus) + `hover.referenceDetail`
(off/summary/definition/full – nur für Referenz-Hover auf Workspace-Symbole).

**✅ Umgesetzt (2026-09-09), Umfang mit Nutzer abgestimmt:** neues
`gessq.hover.enable`-Untersetting `gessq.hover.keywords` (default `true`)
schaltet den Glossar-Hover für Sprach-Keywords separat vom Referenz-Hover ab
(`hoverKeywordsEnabled()` in `src/infra/config.ts`, Guard in
`hoverProvider.ts`). `hover.referenceDetail` deckt die Referenz-Hover-
Kategorie weiterhin ab (dort bereits granularer als gesstabs' einfacher
Boolean, da vierstufig). Eine separate Label-/Codes-Hover-Kategorie gibt es
in gessq aktuell nicht (keine entsprechende Hover-Quelle im Provider) – daher
kein drittes Setting.

---

## Einmalig / manuell

- **Open VSX freischalten** (der CI-Schritt existiert bereits, siehe
  [HISTORY.md](HISTORY.md) §9.9): eclipse.org-Account anlegen, Namespace
  beanspruchen (`npx ovsx create-namespace volkerdobler -p <token>`), Token
  als Repo-Secret `OVSX_PAT` hinterlegen.

---

## Wiederkehrende Wartung

- **Glossar-Abgleich (~alle 1–2 Jahre)** – vollständige Schritt-für-Schritt-
  Anleitung in [tools/README.md](tools/README.md): 1. `tools/index.html` neu aus dem Schlüsselwort-Index speichern (curl mit
  Browser-User-Agent). 2. `node tools/sync-glossary.js` (dry run) → `--write`. 3. `syntax` / `summary` der neuen Einträge von Hand nachtragen (bestehende
  Einträge nicht anfassen, `detail` nur bei Seitenumzug). 4. `node tools/gen-keyword-ignore.js` (dry run) → `--write`; neue
  „code-förmige" Labels prüfen: Grammar oder Ignore-Liste? 5. `assets/gessq-globals.d.ts` (ambient-Decls für die Embedded-JS-Hilfe)
  gegen Handbuch-Kapitel 17 / 26.6 / 16.06–16.13 gegenprüfen – neue
  `QDot.*`- oder Android-JS-Funktionen ergänzen. 6. `npx prettier --write src/data/manualGlossary.json
src/__tests__/fixtures/keywordIndexIgnore.ts` → `npm test`.
- **Nach Grammar-Änderungen**: `npm run gen:language` (CI prüft den Sync von
  `src/data/language.ts`).
