/**
 * Ambient globals available inside GESS Q. `javascript = "…"`, `jsHandler = "…"`
 * and `css = "…"` blocks.
 *
 * The embedded-language support (src/providers/embeddedLanguage.ts) appends the
 * text of this file to the virtual TypeScript document it builds for every JS
 * region, so hover / completion / signature help know about `QDot`, `$`,
 * `Android`, the GESS Q. Android bridge functions, … .
 *
 * Source: GESS Q. handbook chapters 17 (JavaScript events), 26.6 (Android
 * JavaScript functions) and 16.06 / 16.07 / 16.13 (heatplotter, image
 * thumbnails, click ranking). Hand-maintained – re-check against the handbook
 * when the "Wiederkehrende Wartung" glossary sync runs.
 *
 * MUST stay a *script* (no `import` / `export`) so every declaration is global.
 * It is bundled into the `.vsix` (see esbuild.js `ASSETS` and `.vscodeignore`).
 */

/** Placeholder the region scanner leaves where `@insert(…)` / `&macro;` stood. */
declare const _i_: any;

interface QDotLogger {
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
}

interface QDotApi {
	/**
	 * Runs on every screen submit (Weiter **and** Zurück). Assign a function to
	 * override the no-op default; return `false` to abort the navigation and
	 * keep the respondent on the screen.
	 */
	onSubmit: () => boolean | void;
	/**
	 * Read / write any questionnaire variable from any screen:
	 * `QDot.JsonData['myVar'] = 'a value';`
	 */
	JsonData: Record<string, string>;
	logger: QDotLogger;
	keyboard: any;
	clickranking: any;
	heatplotter: any;
	starRating: any;
	audioplayer: any;
	videoplayer: any;
}

declare var QDot: QDotApi;

/** The GESS Q. Android bridge – only present in the Android app (`window.Android`). */
interface AndroidBridge {
	/** Reload the current screen; `js` is appended to the end of the screen. */
	reload(js?: string): void;
	stopRecording(): void;
	[method: string]: any;
}
declare var Android: AndroidBridge | undefined;

declare var $: any;
declare var jQuery: any;

/** Start a background audio recording; the file is stored as `filename`. */
declare function startBackgroundAudioRecording(filename: string): void;
/** Stop the audio recording currently running. */
declare function stopAudioRecording(): void;
/** Open the audio-recorder menu bound to an OpenQ. */
declare function showAudiorecorder(
	openQName: string,
	seconds: number,
	qText?: string,
): void;
/** Open the camera; the photo file name is stored in the given OpenQ. */
declare function openCamera(openQName: string): void;
/** Open the barcode / QR scanner; the result is stored in the given OpenQ. */
declare function openBarcodeScanner(openQName: string): void;
/** Play a video full-screen; returns when the video ends. */
declare function playVideo(pathToVideo: string): void;
/** Start the Net-Block service (Android). */
declare function startNetBlockService(): void;
/** Stop the Net-Block service (Android). */
declare function stopNetBlockService(): void;
/**
 * Show / hide a question's label(s) from a `jsHandler`.
 * @param questionId    the triggering question's id
 * @param hiddenQuestions questions to hide
 * @param labelIds      label codes to react to
 */
declare function hideq(
	questionId: string,
	hiddenQuestions: string[],
	labelIds: string[],
): void;
/** Initialise the zoom layer – call once in a question title. */
declare function insertLayer(closeHint?: string): void;
/** Register a thumbnail / full-size image pair for use in text areas. */
declare function addImage(smallPath: string, bigPath: string): void;
