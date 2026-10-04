'use strict';

/**
 * Parameters valid inside `HTML{ … };`, offered by completion there.
 *
 * `HTML_PARAMETERS` is the list from the manual page "Intervieweinstellungen ›
 * HTML-Parameter" (05_02_html-parameter / 05_02_01_html-weitere-erklaerungen),
 * with options and defaults as documented. `HTML_PARAMETER_EXTRAS` are further
 * parameters the glossary shows in `HTML{ … }` (grid, slider, paired-grid,
 * keyboard-input pages); their documentation comes from the glossary.
 */

/** How the value is written – drives the inserted snippet. */
export type HtmlParamValue =
	| { kind: 'yesno' }
	| { kind: 'text' }
	| { kind: 'number' }
	| { kind: 'condition' }
	| { kind: 'cssLayout' }
	| { kind: 'choice'; options: readonly string[]; quoted?: boolean };

export interface HtmlParameter {
	name: string;
	value: HtmlParamValue;
	default?: string;
	summary: string;
	/** Anchor on the "HTML-Weitere Erklärungen" page. */
	anchor?: string;
}

export const HTML_PARAMETER_DOC_URL =
	'https://help.gessgroup.de/q-help/05_02_01_html-weitere-erklaerungen.html';

const yesno = { kind: 'yesno' } as const;
const text = { kind: 'text' } as const;
const number = { kind: 'number' } as const;
const condition = { kind: 'condition' } as const;

// prettier-ignore
const DOCUMENTED: Omit<HtmlParameter, 'anchor'>[] = [
	{ name: 'BackButton', value: yesno, default: 'no', summary: 'Zurückbutton auf den Screens anzeigen (benötigt `@back` im Template).' },
	{ name: 'BackButtonCnd', value: condition, default: 'true', summary: 'Bedingung, wann der Zurückbutton sichtbar ist (setzt `BackButton = yes` voraus), z. B. `f1 eq 1`.' },
	{ name: 'BackButtonSrc', value: text, summary: 'Eigene Bilddatei für den Zurückbutton (siehe „Grafische Navigationsbuttons“).' },
	{ name: 'BackButtonText', value: text, default: 'zurück', summary: 'Beschriftung des Zurückbuttons (nur ohne `BackButtonSrc`).' },
	{ name: 'CancelButton', value: yesno, default: 'no', summary: 'Abbruchbutton auf den Screens anzeigen (benötigt `@cancel` im Template).' },
	{ name: 'CancelButtonCnd', value: condition, default: 'true', summary: 'Bedingung, wann der Abbruchbutton sichtbar ist (setzt `CancelButton = yes` voraus).' },
	{ name: 'CancelButtonSrc', value: text, summary: 'Eigene Bilddatei für den Abbruchbutton (siehe „Grafische Navigationsbuttons“).' },
	{ name: 'CancelButtonText', value: text, default: 'abbrechen', summary: 'Beschriftung des Abbruchbuttons (nur ohne `CancelButtonSrc`).' },
	{ name: 'ContinueButton', value: yesno, default: 'no', summary: 'Weiterbutton auf den Screens anzeigen (benötigt `@submit` im Template).' },
	{ name: 'ContinueButtonCnd', value: condition, default: 'true', summary: 'Bedingung, wann der Weiterbutton sichtbar ist (setzt `ContinueButton = yes` voraus).' },
	{ name: 'ContinueButtonSrc', value: text, summary: 'Eigene Bilddatei für den Weiterbutton (siehe „Grafische Navigationsbuttons“).' },
	{ name: 'ContinueButtonText', value: text, default: 'weiter', summary: 'Beschriftung des Weiterbuttons (nur ohne `ContinueButtonSrc`).' },
	{ name: 'CssLayout', value: { kind: 'cssLayout' }, default: '"", 2', summary: 'Zusätzliche CSS-Klasse für Fragen und Anzahl alternierender Zeilenlayouts, z. B. `"TeilA", 1`.' },
	{ name: 'ErrorPostText', value: text, default: '""', summary: 'Text hinter einer fehlerhaften Frage (mit `ShowIndividualErrors = yes`); `@msg` fügt den Fehlertext des Asserts ein.' },
	{ name: 'ErrorPreText', value: text, default: '""', summary: 'Text vor einer fehlerhaften Frage (mit `ShowIndividualErrors = yes`); `@msg` fügt den Fehlertext des Asserts ein.' },
	{ name: 'Input', value: yesno, default: 'yes', summary: '`no` unterdrückt die normale Fragedarstellung – für selbstgebaute Screens.' },
	{ name: 'JavascriptAutoOpenLabel', value: yesno, default: 'no', summary: 'Häkchen bei Antworten mit offenem Textfeld automatisch setzen.' },
	{ name: 'JavascriptSingleMode', value: { kind: 'choice', options: ['deselect', 'deactivate'], quoted: true }, default: 'deactivate', summary: 'Klickverhalten bei exklusiven Antworten: `deselect` wählt die anderen ab, `deactivate` sperrt die Auswahl.' },
	{ name: 'LabelOpenCols', value: number, default: '40', summary: 'Spaltenzahl der open-Felder an Labels.' },
	{ name: 'LabelOpenRows', value: number, default: '1', summary: 'Zeilenzahl der open-Felder an Labels.' },
	{ name: 'MaxLabelsPerCol', value: number, default: 'unendlich', summary: 'Maximale Anzahl Antworten pro Spalte bei SingleQ/MultiQ; danach beginnt automatisch eine neue Spalte.' },
	{ name: 'MaxNumAnswers', value: number, default: '10000', summary: 'Maximale Anzahl Nennungen bei MultiQ/MultiGridQ; bei Erreichen wird der Weiterbutton deaktiviert.' },
	{ name: 'MinNumAnswers', value: number, default: '0', summary: 'Minimale Anzahl Nennungen bei MultiQ/MultiGridQ; darunter ist der Weiterbutton deaktiviert.' },
	{ name: 'MultiQClass', value: { kind: 'choice', options: ['MultiQ', 'PackagingQ'], quoted: true }, default: 'MultiQ', summary: 'Alternative Renderklasse für MultiQs (Verpackungskonfigurator).' },
	{ name: 'MultiQFormat', value: { kind: 'choice', options: ['standard', 'table'] }, default: 'standard', summary: 'Layout für MultiQs: `standard` untereinander, `table` nebeneinander mit Buttons darüber.' },
	{ name: 'NumQClass', value: { kind: 'choice', options: ['NumQ', 'GNumQ', 'SliderQ'], quoted: true }, default: 'NumQ', summary: 'Alternative Renderklasse für NumQs (grafische NumQ, Schieberegler).' },
	{ name: 'PBarWidth', value: number, default: '100', summary: 'Breite des Fortschrittsbalkens im Template in Pixel.' },
	{ name: 'ShowQuestionName', value: yesno, default: 'no', summary: 'Skriptnamen der Frage vor dem Titel einblenden (zum Testen).' },
	{ name: 'ShowIndividualErrors', value: yesno, default: 'no', summary: '`ErrorPreText` / `ErrorPostText` im Fehlerfall ausgeben.' },
	{ name: 'ShowLabelValues', value: yesno, default: 'no', summary: 'Labelcodes zu den Antwortmöglichkeiten mit ausgeben.' },
	{ name: 'SingleQAutoSubmit', value: yesno, default: 'no', summary: 'SingleQs springen nach der Antwort automatisch weiter.' },
	{ name: 'SingleQFormat', value: { kind: 'choice', options: ['standard', 'table', 'select'] }, default: 'standard', summary: 'Layout für SingleQs: `standard`, `table` (gekippt) oder `select` (Auswahlliste).' },
	{ name: 'TextAreaCols', value: number, default: '60', summary: 'Spaltenzahl der OpenQ-Felder.' },
	{ name: 'TextAreaRows', value: number, default: '8', summary: 'Zeilenzahl der OpenQ-Felder.' },
	{ name: 'WritePostText', value: yesno, default: 'yes', summary: 'Das Frageattribut `htmlposttext` tatsächlich ausgeben.' },
	{ name: 'WritePreText', value: yesno, default: 'yes', summary: 'Das Frageattribut `htmlpretext` tatsächlich ausgeben.' },
	{ name: 'WriteQText', value: yesno, default: 'yes', summary: 'Das Frageattribut `text` tatsächlich ausgeben.' },
	{ name: 'WriteTitle', value: yesno, default: 'yes', summary: 'Das Frageattribut `title` tatsächlich ausgeben.' },
	{ name: 'TitlePreText', value: text, default: '""', summary: 'Fester Text vor dem variablen Title (alle oder ausgewählte Screens).' },
	{ name: 'TitlePostText', value: text, default: '""', summary: 'Fester Text nach dem variablen Title (alle oder ausgewählte Screens).' },
];

export const HTML_PARAMETERS: readonly HtmlParameter[] = DOCUMENTED.map(
	(p) => ({ ...p, anchor: p.name.toLowerCase() }),
);

/** Further `HTML{ … }` parameters known from the glossary. */
export const HTML_PARAMETER_EXTRAS: readonly {
	name: string;
	options?: readonly string[];
}[] = [
	{ name: 'cancelMenu' },
	{ name: 'cancelMenuDefault' },
	{ name: 'cancelMenuErrorMsg' },
	{ name: 'enableCoBrowsing', options: ['true', 'false'] },
	{ name: 'gridErrorColor' },
	{ name: 'gridHighlighting', options: ['row', 'cell'] },
	{ name: 'highlightColor' },
	{ name: 'highlightGridError' },
	{ name: 'highlightTable' },
	{ name: 'htmlTable' },
	{ name: 'javascriptSingleCheck' },
	{ name: 'ki_active', options: ['yes', 'no'] },
	{ name: 'ki_autocheck', options: ['yes', 'no'] },
	{ name: 'ki_autocomplete', options: ['yes', 'no'] },
	{ name: 'ki_autofocus', options: ['yes', 'no'] },
	{ name: 'mouseEvent', options: ['mouseUp', 'mouseDown'] },
	{ name: 'multiGridQClass' },
	{ name: 'numQTable' },
	{ name: 'openFieldSize' },
	{ name: 'pg_corpus' },
	{ name: 'pg_corpus_padding' },
	{ name: 'pg_fading' },
	{ name: 'pg_group_names' },
	{ name: 'pg_grouping' },
	{ name: 'pg_height' },
	{ name: 'pg_orientations' },
	{ name: 'pg_visibility' },
	{ name: 'pg_visibility_menu' },
	{ name: 'pg_visibility_menu_orientation' },
	{ name: 'pg_visibility_orientation' },
	{ name: 'pg_width' },
	{ name: 'selectLanguage' },
	{ name: 'shareLabels' },
	{ name: 'showSingleQValues' },
	{ name: 'singleGridQClass' },
	{ name: 'singleQClass' },
	{ name: 'singleQTableLabelsFirst' },
	{ name: 'singleValuesAlwaysActivated' },
	{ name: 'sl_unspecified_text' },
];

/** Value options of a parameter (documented or extra), by lowercase name. */
export function htmlParameterOptions(
	name: string,
): { options: readonly string[]; quoted: boolean } | undefined {
	const lower = name.toLowerCase();
	const doc = HTML_PARAMETERS.find((p) => p.name.toLowerCase() === lower);
	if (doc) {
		if (doc.value.kind === 'yesno') {
			return { options: ['yes', 'no'], quoted: false };
		}
		if (doc.value.kind === 'choice') {
			return {
				options: doc.value.options,
				quoted: doc.value.quoted ?? false,
			};
		}
		return undefined;
	}
	const extra = HTML_PARAMETER_EXTRAS.find(
		(p) => p.name.toLowerCase() === lower,
	);
	return extra?.options
		? { options: extra.options, quoted: false }
		: undefined;
}
