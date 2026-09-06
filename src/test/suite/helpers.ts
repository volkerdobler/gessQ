import * as vscode from 'vscode';

/** The extension id (`<publisher>.<name>` from package.json). */
export const EXTENSION_ID = 'volkerdobler.gessq';

export const sleep = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, ms));

/** Activate the extension and give the SymbolIndex a moment to scan. */
export async function activate(): Promise<void> {
	const ext = vscode.extensions.getExtension(EXTENSION_ID);
	if (!ext) {
		throw new Error('extension ' + EXTENSION_ID + ' not found');
	}
	await ext.activate();
	await sleep(1500);
}

/** URI of a fixture file in the test workspace folder. */
export function fixtureUri(name: string): vscode.Uri {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		throw new Error('no workspace folder open');
	}
	return vscode.Uri.joinPath(folder.uri, name);
}

export async function openFixture(name: string): Promise<vscode.TextDocument> {
	const doc = await vscode.workspace.openTextDocument(fixtureUri(name));
	await vscode.window.showTextDocument(doc, { preview: false });
	return doc;
}

/** Flatten a hover result to plain markdown text. */
export function hoverText(hovers: vscode.Hover[] | undefined): string {
	return (hovers ?? [])
		.flatMap((h) => h.contents as (string | vscode.MarkdownString)[])
		.map((c) => (typeof c === 'string' ? c : c.value))
		.join('\n');
}

export function completionLabel(
	item: vscode.CompletionItem | vscode.CompletionList,
): string {
	const i = item as vscode.CompletionItem;
	return typeof i.label === 'string' ? i.label : i.label.label;
}

export async function completionLabels(
	uri: vscode.Uri,
	position: vscode.Position,
	trigger?: string,
): Promise<string[]> {
	const list = await vscode.commands.executeCommand<vscode.CompletionList>(
		'vscode.executeCompletionItemProvider',
		uri,
		position,
		trigger,
	);
	return (list?.items ?? []).map((i) =>
		typeof i.label === 'string' ? i.label : i.label.label,
	);
}

/** Retry `fn` until `ok` holds or `tries` run out – for lazily-warming services. */
export async function retry<T>(
	fn: () => Promise<T>,
	ok: (value: T) => boolean,
	tries = 15,
): Promise<T> {
	let last = await fn();
	for (let i = 0; i < tries && !ok(last); i++) {
		await sleep(1000);
		last = await fn();
	}
	return last;
}
