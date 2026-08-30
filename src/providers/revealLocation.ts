'use strict';

import * as vscode from 'vscode';

/**
 * Internal command that moves an editor to `(uriString, line, character)`.
 * Used by hover links so the "defined at …:N" hint is a jump target. Not
 * contributed to the command palette – only invoked from `command:` links.
 */
export const REVEAL_COMMAND = 'gessq.revealLocation';

/** Register {@link REVEAL_COMMAND}. Call once from `activate`. */
export function registerRevealLocation(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			REVEAL_COMMAND,
			async (uriString: string, line: number, character: number) => {
				try {
					const uri = vscode.Uri.parse(uriString);
					const pos = new vscode.Position(
						Math.max(0, line | 0),
						Math.max(0, character | 0),
					);
					await vscode.window.showTextDocument(uri, {
						selection: new vscode.Range(pos, pos),
					});
				} catch {
					/* the file may have moved – nothing to do */
				}
			},
		),
	);
}

/**
 * A Markdown link (for a hover / `MarkdownString`) that jumps to
 * `uriString:line:character` via {@link REVEAL_COMMAND}. `line` / `character`
 * are 0-based. The `MarkdownString` must allow the command:
 * `md.isTrusted = { enabledCommands: [REVEAL_COMMAND] }`.
 */
export function revealLink(
	label: string,
	uriString: string,
	line: number,
	character: number,
): string {
	const args = encodeURIComponent(
		JSON.stringify([uriString, line, character]),
	);
	return `[${label}](command:${REVEAL_COMMAND}?${args})`;
}
