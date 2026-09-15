'use strict';

import * as vscode from 'vscode';
import { releaseNotesOnUpdate } from './config';
import { renderReleaseNotesMarkdown } from './releaseNotesMarkdown';

/** Command that (re)opens the release notes for the installed version. */
export const SHOW_RELEASE_NOTES_COMMAND = 'gessq.showReleaseNotes';

/** Command that forgets which version's notes were shown (for testing / support). */
export const RESET_RELEASE_NOTES_COMMAND = 'gessq.resetReleaseNotesState';

/** `globalState` key prefix holding, per version, whether the panel's checkbox suppressed it. */
const SUPPRESS_KEY_PREFIX = 'gessq.releaseNotes.suppressed.';

/** Path of a version's notes file, relative to the extension root. */
export function releaseNotesPath(version: string): string {
	return 'release-notes/' + version + '.md';
}

/**
 * Whether the auto "what's new" should fire, given the
 * `releaseNotes.showOnUpdate` setting and this version's stored checkbox
 * state (`undefined`/`false` until the user checks "Nicht mehr anzeigen"
 * and closes the panel).
 */
export function shouldShowReleaseNotes(
	showOnUpdate: boolean,
	suppressed: boolean | undefined,
): boolean {
	return showOnUpdate && suppressed !== true;
}

/** Contents of the release-notes file for `version`, or `undefined` if there is none. */
async function noteContents(
	extensionUri: vscode.Uri,
	version: string,
): Promise<string | undefined> {
	const uri = vscode.Uri.joinPath(
		extensionUri,
		...releaseNotesPath(version).split('/'),
	);
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString('utf8');
	} catch {
		return undefined;
	}
}

function getNonce(): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	for (let i = 0; i < 32; i++) {
		out += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return out;
}

function renderPanelHtml(
	webview: vscode.Webview,
	version: string,
	markdown: string,
): string {
	const nonce = getNonce();
	const body = renderReleaseNotesMarkdown(markdown);
	const csp = [
		`default-src 'none'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
	body {
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
		color: var(--vscode-foreground);
		padding: 0 24px 24px;
		max-width: 800px;
	}
	h1, h2, h3 { color: var(--vscode-foreground); }
	a { color: var(--vscode-textLink-foreground); }
	code {
		font-family: var(--vscode-editor-font-family);
		background: var(--vscode-textCodeBlock-background);
		padding: 0 4px;
		border-radius: 3px;
	}
	.checkbox-row {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--vscode-panel-border);
	}
	.checkbox-row label { cursor: pointer; }
</style>
</head>
<body>
<h1>Release Notes – GESS Q. ${version}</h1>
${body}
<div class="checkbox-row">
	<label>
		<input type="checkbox" id="dontShowAgain" checked>
		Für Version ${version} nicht mehr automatisch anzeigen
	</label>
</div>
<script nonce="${nonce}">
	const vscodeApi = acquireVsCodeApi();
	document.getElementById('dontShowAgain').addEventListener('change', (e) => {
		vscodeApi.postMessage({ type: 'dontShowAgain', value: e.target.checked });
	});
</script>
</body>
</html>`;
}

/**
 * Open the release notes as an interactive webview panel with a "don't show
 * this again" checkbox (checked by default). The checkbox's state at the
 * moment the panel closes is written to `suppressKey`, gating future
 * automatic (not manually triggered) openings for this version.
 */
function showReleaseNotesPanel(
	context: vscode.ExtensionContext,
	version: string,
	markdown: string,
	suppressKey: string,
): void {
	const panel = vscode.window.createWebviewPanel(
		'gessqReleaseNotes',
		`Release Notes – GESS Q. ${version}`,
		vscode.ViewColumn.One,
		{ enableScripts: true },
	);

	// The checkbox starts checked (see renderPanelHtml) – closing the panel
	// without touching it suppresses this version going forward, matching
	// the checkbox's own visible default.
	let dontShowAgain = true;
	panel.webview.onDidReceiveMessage(
		(message: { type?: string; value?: boolean }) => {
			if (message?.type === 'dontShowAgain') {
				dontShowAgain = !!message.value;
			}
		},
	);

	panel.webview.html = renderPanelHtml(panel.webview, version, markdown);

	panel.onDidDispose(() => {
		void context.globalState.update(suppressKey, dontShowAgain);
	});

	context.subscriptions.push(panel);
}

/**
 * Register the release-notes commands and, once per version (unless
 * `gessq.releaseNotes.showOnUpdate` is off, or the checkbox already
 * suppressed this version), open the notes for the freshly installed /
 * updated version (`release-notes/<v>.md`, if that file exists).
 */
export function activateReleaseNotes(context: vscode.ExtensionContext): void {
	const version = String(context.extension.packageJSON.version ?? '');
	const devMode =
		context.extensionMode !== vscode.ExtensionMode.Production;
	const suppressKey = SUPPRESS_KEY_PREFIX + version;

	context.subscriptions.push(
		vscode.commands.registerCommand(
			SHOW_RELEASE_NOTES_COMMAND,
			async () => {
				const markdown = await noteContents(context.extensionUri, version);
				if (markdown !== undefined) {
					showReleaseNotesPanel(context, version, markdown, suppressKey);
				} else {
					void vscode.window.showInformationMessage(
						`GESS Q.: keine Release Notes für Version ${version}.`,
					);
				}
			},
		),
	);

	// Development / test only – gates the palette entry (see the
	// `menus.commandPalette` "when" in package.json) and the handler itself.
	void vscode.commands.executeCommand('setContext', 'gessq.devMode', devMode);
	if (devMode) {
		context.subscriptions.push(
			vscode.commands.registerCommand(
				RESET_RELEASE_NOTES_COMMAND,
				async () => {
					await context.globalState.update(suppressKey, undefined);
					void vscode.window.showInformationMessage(
						'GESS Q.: Release-Notes-Status zurückgesetzt – nach ' +
							'„Developer: Reload Window" erscheinen die Release ' +
							'Notes wieder automatisch.',
					);
				},
			),
		);
	}

	if (
		!shouldShowReleaseNotes(
			releaseNotesOnUpdate(),
			context.globalState.get<boolean>(suppressKey),
		)
	) {
		return;
	}

	void (async () => {
		const markdown = await noteContents(context.extensionUri, version);
		if (markdown !== undefined) {
			showReleaseNotesPanel(context, version, markdown, suppressKey);
		}
	})();
}
