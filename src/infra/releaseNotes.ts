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

/** `a` vs. `b` as `x.y.z` version strings – negative/0/positive, like `Array.sort`'s comparator. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}
	return 0;
}

/**
 * Which of `available` versions' release notes are still owed to the user,
 * oldest first: every version up to and including `currentVersion` that
 * isn't already suppressed. This is what lets a jump from 1.0.0 straight to
 * 1.0.2 (skipping 1.0.1, e.g. a quick follow-up fix) still show 1.0.1's
 * notes instead of silently dropping them – while a version the user
 * already saw and dismissed never repeats.
 */
export function pendingVersions(
	available: readonly string[],
	currentVersion: string,
	showOnUpdate: boolean,
	suppressedFor: (version: string) => boolean | undefined,
): string[] {
	return available
		.filter((v) => compareVersions(v, currentVersion) <= 0)
		.filter((v) => shouldShowReleaseNotes(showOnUpdate, suppressedFor(v)))
		.sort(compareVersions);
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

/** Versions with a `release-notes/<v>.md` file bundled in this install. */
async function availableVersions(extensionUri: vscode.Uri): Promise<string[]> {
	const dir = vscode.Uri.joinPath(extensionUri, 'release-notes');
	try {
		const entries = await vscode.workspace.fs.readDirectory(dir);
		const versions: string[] = [];
		for (const [name] of entries) {
			const m = /^(\d+\.\d+\.\d+)\.md$/.exec(name);
			if (m) {
				versions.push(m[1]);
			}
		}
		return versions;
	} catch {
		return [];
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
	title: string,
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
<h1>${title}</h1>
${body}
<div class="checkbox-row">
	<label>
		<input type="checkbox" id="dontShowAgain" checked>
		Diese Release Notes nicht mehr automatisch anzeigen
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
 * moment the panel closes is written to every key in `suppressKeys`, gating
 * future automatic (not manually triggered) openings for those versions –
 * more than one when the panel bundles several versions' notes at once (see
 * `pendingVersions`).
 */
function showReleaseNotesPanel(
	context: vscode.ExtensionContext,
	title: string,
	markdown: string,
	suppressKeys: readonly string[],
): void {
	const panel = vscode.window.createWebviewPanel(
		'gessqReleaseNotes',
		title,
		vscode.ViewColumn.One,
		{ enableScripts: true },
	);

	// The checkbox starts checked (see renderPanelHtml) – closing the panel
	// without touching it suppresses these versions going forward, matching
	// the checkbox's own visible default.
	let dontShowAgain = true;
	panel.webview.onDidReceiveMessage(
		(message: { type?: string; value?: boolean }) => {
			if (message?.type === 'dontShowAgain') {
				dontShowAgain = !!message.value;
			}
		},
	);

	panel.webview.html = renderPanelHtml(panel.webview, title, markdown);

	panel.onDidDispose(() => {
		for (const key of suppressKeys) {
			void context.globalState.update(key, dontShowAgain);
		}
	});

	context.subscriptions.push(panel);
}

/**
 * Register the release-notes commands and, once per version (unless
 * `gessq.releaseNotes.showOnUpdate` is off), open the notes for every
 * version up to and including the freshly installed / updated one that the
 * user hasn't already seen (see `pendingVersions`) – so a quick follow-up
 * release doesn't silently swallow the notes from the version(s) before it
 * for someone updating straight past them.
 */
export function activateReleaseNotes(context: vscode.ExtensionContext): void {
	const version = String(context.extension.packageJSON.version ?? '');
	const devMode =
		context.extensionMode !== vscode.ExtensionMode.Production;
	const suppressKey = (v: string): string => SUPPRESS_KEY_PREFIX + v;

	context.subscriptions.push(
		vscode.commands.registerCommand(
			SHOW_RELEASE_NOTES_COMMAND,
			async () => {
				const markdown = await noteContents(context.extensionUri, version);
				if (markdown !== undefined) {
					showReleaseNotesPanel(
						context,
						`Release Notes – GESS Q. ${version}`,
						markdown,
						[suppressKey(version)],
					);
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
					const versions = await availableVersions(context.extensionUri);
					for (const v of new Set([...versions, version])) {
						await context.globalState.update(suppressKey(v), undefined);
					}
					void vscode.window.showInformationMessage(
						'GESS Q.: Release-Notes-Status zurückgesetzt – nach ' +
							'„Developer: Reload Window" erscheinen die Release ' +
							'Notes wieder automatisch.',
					);
				},
			),
		);
	}

	const showOnUpdate = releaseNotesOnUpdate();
	if (!showOnUpdate) {
		return;
	}

	void (async () => {
		const versions = await availableVersions(context.extensionUri);
		const pending = pendingVersions(versions, version, showOnUpdate, (v) =>
			context.globalState.get<boolean>(suppressKey(v)),
		);
		if (pending.length === 0) {
			return;
		}

		const sections = await Promise.all(
			pending.map((v) => noteContents(context.extensionUri, v)),
		);
		const markdown = sections
			.filter((s): s is string => s !== undefined)
			.join('\n\n');
		if (markdown.length === 0) {
			return;
		}

		const title =
			pending.length === 1
				? `Release Notes – GESS Q. ${pending[0]}`
				: `Release Notes – GESS Q. ${pending[0]}–${pending[pending.length - 1]}`;
		showReleaseNotesPanel(context, title, markdown, pending.map(suppressKey));
	})();
}
