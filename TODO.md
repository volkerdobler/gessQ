# TODO – GESS Q. VS Code Extension

Abgeschlossene Arbeit, die Ausgangs-Analyse und der Entscheidungslog stehen in
[HISTORY.md](HISTORY.md).

---

## Vorgemerkt (aus gesstabs-Vergleich, 2026-09-09)

Aktuell kein akuter Bedarf, aber fertig zum Kopieren falls der Bedarf entsteht.
Der vollständige Vergleich (inkl. was daraus bereits umgesetzt wurde) steht in
[HISTORY.md](HISTORY.md) §8 Phase 6.

- `gesstabs/src/util/glob.ts` – kleine `globToRegExp`/`matchesAnyPattern`-
  Funktion (Basename-Wildcards `*`/`?`, case-insensitive), ~15 Zeilen. gessq
  reicht `gessq.files.exclude` aktuell direkt als Glob-String an
  `vscode.workspace.findFiles` durch (funktioniert) – relevant nur, falls
  gessq mal eigenes Basename-Pattern-Matching braucht (z.B. ein künftiges
  „welche Dateien gehören zum Projekt"-Setting).
- `gesstabs/src/util/lru.ts` – TTL-LRU-Cache. Kein Bedarf, solange teure
  Datei-Scans über den `SymbolIndex` laufen (der hat bereits Watcher +
  Debounce). Nur falls künftig teure Scans _außerhalb_ des SymbolIndex
  entstehen.
- `gesstabs/src/providers/externalNamesProvider.ts` – Architekturmuster (pro
  Workspace-Ordner ein `FileSystemWatcher` + In-Flight-Dedupe-Map +
  `invalidate()` bei Config-Änderung + Cache keyed by mtime/size). Kein
  direktes Ziel in gessq heute, aber Vorlage falls gessq mal externe
  Abhängigkeiten bekommt (z.B. ein Äquivalent zu mehreren Einstiegsskripten
  statt dem festen `script.q`-Root, oder externe JSON-Schemas).

## Offene Entscheidung

### B2 – `language.json` als Single Source

Eine gepflegte Datendatei generiert Grammar-Keyword-Listen, Completion-Items,
Hover-Texte und Signaturhilfe-Parameter aus **einer** Quelle (statt Grammar
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
