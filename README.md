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
- **Auto-Vervollständigung** von Schlüsselwörtern.
- **Hover** mit Kurzbeschreibung und Link in die GESS-Onlinehilfe
  (auf Basis von `manualGlossary.json`).
- **Signaturhilfe** (Parameterhinweise) für Makro-/Funktionsaufrufe.

## Einstellungen

| Einstellung        | Typ       | Standard | Beschreibung                                             |
| ------------------ | --------- | -------- | ------------------------------------------------------- |
| `gessq.debugMode`  | `boolean` | `false`  | Debug-Logging in den Output-Channel „gessQ“ aktivieren. |

## Entwicklung

```bash
npm install
npm run compile      # bzw. npm run watch
npm test             # Unit-Tests (jest)
```

Zum Debuggen in VS Code die Konfiguration **„Run Extension“** (F5) starten.

## Release Notes

Die Extension befindet sich noch in einer Alpha-Phase. Details siehe
[CHANGELOG.md](CHANGELOG.md).

## Contributors 🙏

Ein großes Dankeschön an alle, die zu diesem Projekt beigetragen haben:

- Sebastian Zagaria (GESS GmbH) – verbessertes Syntax-Highlighting
- alle GESS-GmbH-Programmiererinnen und -Programmierer – Snippets

**Enjoy!**
