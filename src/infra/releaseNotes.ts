'use strict';

import * as vscode from 'vscode';
import { releaseNotesOnUpdate } from './config';

/** Command that (re)opens the release notes for the installed version. */
export const SHOW_RELEASE_NOTES_COMMAND = 'gessq.showReleaseNotes';

/** `globalState` key holding the version whose notes were last shown. */
const SHOWN_KEY = 'gessq.releaseNotesShownFor';

/** Path of a version's notes file, relative to the extension root. */
export function releaseNotesPath(version: string): string {
	return 'release-notes/' + version + '.md';
}

/** Whether the auto "what's new" should fire for `current`. */
export function shouldShowReleaseNotes(
	shownVersion: string | undefined,
	current: string,
): boolean {
	return current.length > 0 && shownVersion !== current;
}

/** URI of the release-notes file for `version`, or `undefined` if there is none. */
async function noteUri(
	extensionUri: vscode.Uri,
	version: string,
): Promise<vscode.Uri | undefined> {
	const uri = vscode.Uri.joinPath(
		extensionUri,
		...releaseNotesPath(version).split('/'),
	);
	try {
		await vscode.workspace.fs.stat(uri);
		return uri;
	} catch {
		return undefined;
	}
}

/** Open `uri` as a rendered Markdown preview, falling back to a plain editor. */
async function openNotes(uri: vscode.Uri): Promise<void> {
	try {
		await vscode.commands.executeCommand('markdown.showPreview', uri);
	} catch {
		try {
			await vscode.window.showTextDocument(
				await vscode.workspace.openTextDocument(uri),
			);
		} catch {
			/* the file vanished between the stat and here – nothing to do */
		}
	}
}

/**
 * Register {@link SHOW_RELEASE_NOTES_COMMAND} and, once per version (unless
 * `gessq.releaseNotes.showOnUpdate` is off), open the notes for the freshly
 * installed / updated version (`release-notes/<v>.md`, if that file exists).
 */
export function activateReleaseNotes(context: vscode.ExtensionContext): void {
	const version = String(context.extension.packageJSON.version ?? '');

	context.subscriptions.push(
		vscode.commands.registerCommand(
			SHOW_RELEASE_NOTES_COMMAND,
			async () => {
				const uri = await noteUri(context.extensionUri, version);
				if (uri) {
					await openNotes(uri);
				} else {
					void vscode.window.showInformationMessage(
						`GESS Q.: keine Release Notes für Version ${version}.`,
					);
				}
			},
		),
	);

	if (
		!releaseNotesOnUpdate() ||
		!shouldShowReleaseNotes(
			context.globalState.get<string>(SHOWN_KEY),
			version,
		)
	) {
		return;
	}

	void (async () => {
		const uri = await noteUri(context.extensionUri, version);
		if (uri) {
			await openNotes(uri);
		}
		// Mark as done even without a file, so it stays "once per version".
		await context.globalState.update(SHOWN_KEY, version);
	})();
}
