# gessQ

VS Code Sprachunterstützung für **gess.Q**, die Skriptsprache für
Online-Befragungen von [GESS](https://www.gessgroup.de).

Betrifft Dateien mit der Endung `.q`.

## Features

- **Syntax-Highlighting** über eine TextMate-Grammatik (inkl. eingebettetem
  JavaScript/CSS in `javascript=`/`jsHandler=`/`css=`-Blöcken).
- **Snippets** für Fragetypen, ActionBlocks, Filter, Grids, Server-Settings
  u. v. m.
- **Symbol-Navigation**
  - Gliederung / „Go to Symbol in File“ (`Strg+Shift+O`) – Fragen,
    Definitionen, Blöcke, ActionBlocks.
  - „Go to Symbol in Workspace“ (`Strg+T`) – über alle `.q`-Dateien des
    Projekts inkl. Unterordner.
  - „Go to Definition“ (`F12`) und „Find All References“ (`Shift+F12`).
- **Folding** für `#macro`/`#endmacro`, `#ifdef`/`#endif`, `{ … }` und
  Blockkommentare.
- **Auto-Vervollständigung**: Schlüsselwörter, Workspace-Symbole (Fragen,
  Blöcke, Makros, …) und – kontextabhängig – Präprozessor-Direktiven nach
  `#`/`@` bzw. Makronamen nach `&`. Glossar-Beschreibung beim Markieren.
- **Hover** mit Kurzbeschreibung und Link in die GESS-Onlinehilfe
  (auf Basis von `manualGlossary.json`).
- **Signaturhilfe** (Parameterhinweise) für Makro-/Funktionsaufrufe.

## Einstellungen

| Einstellung       | Typ      | Standard  | Beschreibung                                                        |
| ----------------- | -------- | --------- | ------------------------------------------------------------------ |
| `gessq.logLevel`  | `string` | `"error"` | Ausführlichkeit des Output-Channels „gessQ“ (`off`…`debug`).       |
| `gessq.debugMode` | `boolean`| `false`   | Veraltet – entspricht `gessq.logLevel = debug`.                    |

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
