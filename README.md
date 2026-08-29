# GESS Q.

VS Code Sprachunterstützung für **GESS Q.**, die Skriptsprache für
Online-Befragungen von [GESS](https://www.gessgroup.de).

Betrifft Dateien mit der Endung `.q`.

## Features

- **Syntax-Highlighting** über eine TextMate-Grammatik (inkl. eingebettetem
  JavaScript/CSS/HTML in `javascript=`/`css=`/`html=`/`text=`-Blöcken).
- **Snippets** für Fragetypen, ActionBlocks, Filter, Grids, Server-Settings
  u. v. m.
- **Symbol-Navigation** über einen inkrementellen Workspace-Index:
  - Gliederung / „Go to Symbol in File“ (`Strg+Shift+O`) und Workspace
    (`Strg+T`) – Fragen, opennumformat, Blöcke/Screens, Makros, Action-Ziele,
    `array`/`vararray`- und `quotavar`-Variablen.
  - „Go to Definition“ (`F12`), „Find All References“ (`Shift+F12`),
    **Rename** (`F2`), **CodeLens** („N references“), Vorkommen-Highlighting.
- **Diagnostics**: unbalancierte `{}`/`()`, offene `#macro`/`#ifdef`, fehlende
  `#include`-Dateien, doppelte Namen, unbekanntes `#domacro`-Ziel
  (`gessq.diagnostics.enable`).
- **Klickbare `#include`-Pfade**.
- **Folding** für `#macro`/`#endmacro`, `#ifdef`/`#endif`, `{ … }` und
  Blockkommentare.
- **Auto-Vervollständigung**: Schlüsselwörter, Workspace-Symbole und –
  kontextabhängig – Direktiven nach `#`/`@` bzw. Makronamen nach `&`;
  Glossar-Beschreibung beim Markieren.
- **Hover** mit Glossar-Beschreibung (Kurzname, ggf. Syntaxzeile + gekürzte
  Beschreibung, Handbuch-Link) bzw. Definitionsort + Code-Vorschau
  (`gessq.hover.enable`; auf der Definitionszeile selbst unterdrückt).
- **Signaturhilfe** (Parameterhinweise) für Makro-/Funktionsaufrufe.
- **Formatierung** (experimentell, nur auf „Format Document“): Re-Einrückung
  nach Klammertiefe.

## Einstellungen

| Einstellung                                | Typ       | Standard  | Beschreibung                                                        |
| ------------------------------------------ | --------- | --------- | ------------------------------------------------------------------ |
| `gessq.logLevel`                           | `string`  | `"error"` | Ausführlichkeit des Output-Channels „GESS Q.“ (`off`…`debug`).     |
| `gessq.diagnostics.enable`                 | `boolean` | `true`    | Linter (Klammern, `#macro`/`#ifdef`, `#include`, Duplikate) an/aus. |
| `gessq.completion.includeWorkspaceSymbols` | `boolean` | `true`    | Symbolnamen aus dem Workspace als Vervollständigung anbieten.       |
| `gessq.hover.enable`                       | `boolean` | `true`    | GESS Q.-Hover (Glossar + Definitionsort) anzeigen.                  |
| `gessq.codeLens.enable`                    | `boolean` | `true`    | „N references“-CodeLens über Definitionen anzeigen.                 |
| `gessq.files.exclude`                      | `string`  | `""`      | Zusätzliches Glob, das vom Workspace-Scan ausgeschlossen wird.      |
| `gessq.debugMode`                          | `boolean` | `false`   | Veraltet – entspricht `gessq.logLevel = debug`.                    |

## Entwicklung

```bash
npm install
npm run compile      # esbuild-Bundle nach out/ (bzw. npm run watch)
npm run check        # tsc --noEmit + eslint
npm test             # Unit-Tests (jest)
npm run package      # .vsix bauen (vsce)
```

Zum Debuggen in VS Code die Konfiguration **„Run Extension“** (F5) starten.

## Release Notes

Die Extension befindet sich noch in einer Alpha-Phase. Details siehe
[CHANGELOG.md](CHANGELOG.md).

## Lizenz

Academic Free License v3.0 (AFL-3.0) – siehe [LICENSE](LICENSE).

## Contributors 🙏

Ein großes Dankeschön an alle, die zu diesem Projekt beigetragen haben:

- Sebastian Zagaria (GESS GmbH) – verbessertes Syntax-Highlighting
- alle GESS-GmbH-Programmiererinnen und -Programmierer – Snippets

**Enjoy!**
