# GESS Q.

Unterstützung für **GESS Q.** in Visual Studio Code – die Skriptsprache für
Online-Befragungen von [GESS](https://www.gessgroup.de). Sobald du eine
`.q`-Datei öffnest, hilft die Erweiterung beim Schreiben und Prüfen des
Fragebogenskripts: farbige Syntax, Vorschläge beim Tippen, Erklärungen zu jedem
Befehl, Sprung zur Definition einer Frage, Hinweise auf typische Fehler.

> **Testversion 0.99.0** – interner Testbuild, wird nur als `.vsix` verteilt
> (nicht über den Marketplace). Rückmeldungen bitte an Volker Dobler.

## Installation

1. In VS Code die Ansicht **Erweiterungen** öffnen (`Strg+Shift+X`).
2. Oben im „…“-Menü **Aus VSIX installieren…** wählen und die `.vsix`-Datei
   angeben. (Alternativ die `.vsix` einfach ins VS-Code-Fenster ziehen.)
3. VS Code neu laden, wenn danach gefragt wird.

`.q`-Dateien werden ab jetzt als „GESS Q.“ erkannt (unten rechts in der
Statusleiste sichtbar). Eine neuere Testversion installierst du genauso –
sie ersetzt die alte.

## Was die Erweiterung kann

- **Farbige Syntax** für Fragetypen, ActionBlöcke, Filter, Direktiven,
  Labels, Kommentare usw. – inklusive des HTML-, CSS- und JavaScript-Codes in
  `html=` / `text=` / `css=` / `javascript=` / `jsHandler=`.

- **Vorschläge beim Tippen** (`Strg+Leertaste` erzwingt sie):
  - Schlüsselwörter der Sprache – mit Kurzbeschreibung,
  - Namen von Fragen, Blöcken, Screens, Makros und `opennumformat`s, die
    irgendwo im geöffneten Projekt vorkommen,
  - nur passende Vorschläge je nach Stelle: Direktiven nach `#` bzw. `@`,
    Makronamen nach `&` und `#domacro `, `html` / `thymeleaf` nach
    `rendering =`.

- **Erklärung beim Zeigen mit der Maus (Hover)**: zu praktisch jedem
  Schlüsselwort ein kurzer Syntaxhinweis, ein bis drei erklärende Sätze und
  ein Link ins GESS-Q.-Handbuch. Zeigst du auf einen selbst vergebenen
  Fragen-/Block-/Makronamen, steht dort, in welcher Datei und Zeile er
  definiert ist (die Angabe `Datei:Zeile` ist ein Link – Klick springt
  dorthin); wie viel sonst noch gezeigt wird, steuert
  `gessq.hover.referenceDetail`.

- **Navigation im Skript** (auch über `#include` hinweg):
  - Als „Projekt“ zählt `script.q` (genau dieser Name) plus alles, was von
    dort über `#include` / `#includeifexists` erreichbar ist – ältere Kopien
    wie `script_v1.q` liefern also keine veralteten Treffer mehr. Ist ein
    Ordner geöffnet, wird darin nach `script.q` gesucht; sonst neben der
    geöffneten Datei. Findet sich keine, gilt nur die geöffnete Datei samt
    ihren `#include`s.
  - Datei-Gliederung (`Strg+Shift+O`) und projektweite Suche nach
    Definitionen (`Strg+T`) – Fragen, `opennumformat`, Blöcke/Screens,
    Makros, ActionBlock-Ziele, `array` / `vararray` / `quotavar` /
    `quotagroup`.
  - **Zur Definition springen** (`F12`), **Alle Verweise** (`Shift+F12`) und
    **Umbenennen** (`F2`) – projektweit, inklusive `&name;`- und
    `#domacro`-Aufrufen bei Makros.
  - Über jeder Definition steht, wie oft sie verwendet wird (Klick zeigt die
    Fundstellen); alle Vorkommen des Worts unter dem Cursor werden markiert.

- **`#include` / `#includeifexists`**: der Dateiname ist anklickbar und öffnet
  die eingebundene Datei.

- **Fehlerhinweise** (abschaltbar, siehe *Einstellungen*):
  - unbalancierte `{ }` oder `( )`,
  - `#macro` ohne `#endmacro`, `#ifdef` / `#ifndef` ohne `#endif`,
  - `#include`-Datei nicht vorhanden,
  - derselbe Name doppelt vergeben,
  - `#domacro` auf ein Makro, das es nicht gibt,
  - `rendering =` mehrfach oder erst nach der ersten Frage gesetzt.

- **Ein-/Ausklappen** von `#macro`-Bereichen, `#ifdef`-Bereichen, `{ … }` und
  Blockkommentaren.

- **Parameterhinweise** bei Makro- und Funktionsaufrufen.

- **Snippets** (Textbausteine) für Fragetypen, ActionBlöcke, Filter, Grids,
  Server-Einstellungen u. v. m.

- **Automatische Einrückung** – nur auf Befehl (**Dokument formatieren**),
  richtet die Einrückung nach der `{`/`(`-Verschachtelung aus. Experimentell.

- **„Was ist neu?"** – nach einer Installation oder einem Update öffnet sich
  einmalig die Release-Notes-Seite der neuen Version (falls vorhanden;
  abschaltbar über `gessq.releaseNotes.showOnUpdate`). Jederzeit erneut über
  die Befehlspalette (`Strg+Shift+P`): **GESS Q.: Release Notes anzeigen**
  – bzw. **… Release-Notes-Status zurücksetzen**, damit die einmalige
  Anzeige beim nächsten Fensterneustart wieder erscheint.

## Einstellungen

Über *Datei → Einstellungen → Einstellungen* nach „GESS Q.“ suchen, oder in der
`settings.json`:

| Einstellung                                | Typ       | Standard  | Beschreibung                                                                 |
| ------------------------------------------ | --------- | --------- | --------------------------------------------------------------------------- |
| `gessq.diagnostics.enable`                 | `boolean` | `true`    | Fehlerhinweise (siehe oben) an- oder ausschalten.                          |
| `gessq.hover.enable`                       | `boolean` | `true`    | Erklärung beim Zeigen mit der Maus an- oder ausschalten.                   |
| `gessq.hover.referenceDetail`              | `string`  | `"summary"` | Wie viel der Hover über einer Fragen-/Variablen-*Referenz* zeigt: `off`, `summary` (Name, Art, Fundort der Definition – ohne Beschreibung/Link), `definition` (zusätzlich ein Auszug der Definition ohne actionblock/js/css) oder `full` (komplette Definition). |
| `gessq.codeLens.definitions`               | `string`  | `"reusable"` | Über welchen Definitionen die „N Verweise“-Zeile erscheint: `off`, `questions` (nur Fragen), `reusable` (Fragen + opennumformat/block/screen/#macro/quotavar) oder `all` (auch compute/array/textelement/…). `set`/`load`-Ziele nie. |
| `gessq.completion.includeWorkspaceSymbols` | `boolean` | `true`    | Auch Namen aus dem Projekt (Fragen, Blöcke, Makros …) vorschlagen.         |
| `gessq.files.exclude`                      | `string`  | `""`      | Zusätzliches Ordnermuster, das beim projektweiten Scan übersprungen wird (z. B. `**/backup/**`). |
| `gessq.releaseNotes.showOnUpdate`          | `boolean` | `true`    | Release Notes nach Installation/Update einmalig anzeigen. Der Befehl bleibt in jedem Fall verfügbar. |
| `gessq.logLevel`                           | `string`  | `"error"` | Umfang der Meldungen im Ausgabe-Kanal „GESS Q.“ (`off` … `debug`).         |

## Bekannte Einschränkungen (Testversion)

- Innerhalb von `javascript=` / `jsHandler=` / `css=` gibt es nur die Farbe –
  keine echte JavaScript-/CSS-Hilfe (Autovervollständigung, Fehlerprüfung).
  Das ist für eine spätere Version geplant.
- **Dokument formatieren** ändert nur die Einrückung, sonst nichts.
- Die Handbuch-Links im Hover sind ein Schnappschuss; wenn GESS eine
  Handbuch-Seite verschiebt, kann ein Link ins Leere zeigen.

## Fehler melden

Auffälligkeiten, falsche Erklärungen oder Wünsche bitte an Volker Dobler bzw.
über die [Issues des Projekts](https://github.com/volkerdobler/gessQ/issues).
Hilfreich: die betroffene Skriptzeile und was du erwartet hättest.

## Lizenz

Academic Free License v3.0 (AFL-3.0) – siehe [LICENSE](LICENSE).

## Mitwirken

Wer am Quellcode der Erweiterung selbst arbeiten möchte:

```bash
npm install
npm run compile      # Bundle nach out/ (npm run watch: bei Änderungen neu)
npm run check        # Typprüfung + Lint
npm test             # Unit-Tests
npm run package      # .vsix bauen
```

Zum Ausprobieren im Debugger in VS Code die Startkonfiguration
**„Run Extension“** (`F5`) starten. Details zu den einzelnen Versionen:
[CHANGELOG.md](CHANGELOG.md).

## Danke 🙏

- Sebastian Zagaria (GESS GmbH) – verbessertes Syntax-Highlighting
- alle GESS-GmbH-Programmiererinnen und -Programmierer – Snippets

**Viel Erfolg beim Skripten!**
