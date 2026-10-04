'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import {
	scanEmbeddedRegions,
	buildVirtualContent,
	regionAtOffset,
	type EmbeddedLanguage,
	type EmbeddedRegion,
} from '../core/embeddedRegions';
import {
	loadEmbeddedGlobals,
	loadUserDeclarations,
} from '../data/embeddedGlobals';
import {
	embeddedDeclarationFiles,
	embeddedLanguagesEnabled,
} from '../infra/config';
import {
	parseDeclarationDefaults,
	lookupDefault,
	propertySnippet,
	assignmentSnippet,
	propertySlot,
	type DeclarationDefaults,
} from '../core/declarationDefaults';

/**
 * Real language features for the embedded `javascript = "…"` / `jsHandler = "…"`
 * / `css = "…"` blocks of a GESS Q. file.
 *
 * TextMate only colours these regions – no language service runs in a foreign
 * grammar. So, like VS Code does for `<script>` / `<style>` in HTML, every
 * request is forwarded to a **virtual document**: the `.q` text with everything
 * outside the relevant regions replaced by spaces (same length → positions map
 * 1:1), served under a private scheme with a `.ts` / `.css` path so the
 * built-in JS/TS and CSS language services pick it up.
 *
 * Only hover, completion and signature help are forwarded. Diagnostics are not
 * (a half-blanked file produces noise), so a JS mistake in a block is never
 * surfaced twice.
 */

const SCHEME: Record<EmbeddedLanguage, string> = {
	javascript: 'gessq-embedded-js',
	css: 'gessq-embedded-css',
};
const EXT: Record<EmbeddedLanguage, string> = {
	javascript: 'ts',
	css: 'css',
};

const SELECTOR: vscode.DocumentSelector = [
	{ language: 'gessq', scheme: 'file' },
	{ language: 'gessq', scheme: 'untitled' },
];

// ---------------------------------------------------------------------------
// Region lookup (cached per document version)
// ---------------------------------------------------------------------------

const regionCache = new Map<
	string,
	{ version: number; regions: EmbeddedRegion[] }
>();

/** Embedded regions of `document`, memoised until its version changes. */
export function embeddedRegionsOf(
	document: vscode.TextDocument,
): EmbeddedRegion[] {
	const key = document.uri.toString();
	const hit = regionCache.get(key);
	if (hit && hit.version === document.version) {
		return hit.regions;
	}
	const regions = scanEmbeddedRegions(document.getText());
	regionCache.set(key, { version: document.version, regions });
	return regions;
}

/** The embedded region under `position`, or `undefined`. */
export function embeddedRegionAt(
	document: vscode.TextDocument,
	position: vscode.Position,
): EmbeddedRegion | undefined {
	return regionAtOffset(
		embeddedRegionsOf(document),
		document.offsetAt(position),
	);
}

/**
 * True when the built-in providers should stand aside here: the feature is on
 * and `position` is inside an embedded JS / CSS region.
 */
export function suppressForEmbedded(
	document: vscode.TextDocument,
	position: vscode.Position,
): boolean {
	return embeddedLanguagesEnabled() && !!embeddedRegionAt(document, position);
}

function forgetRegions(uri: vscode.Uri): void {
	regionCache.delete(uri.toString());
}

// ---------------------------------------------------------------------------
// Virtual URIs
// ---------------------------------------------------------------------------

/** `<scheme>:/<encoded original uri>.<ext>` – no authority. */
export function virtualUri(
	original: vscode.Uri,
	language: EmbeddedLanguage,
): vscode.Uri {
	const encoded = encodeURIComponent(original.toString());
	return vscode.Uri.from({
		scheme: SCHEME[language],
		path: '/' + encoded + '.' + EXT[language],
	});
}

/** The `.q` URI string encoded in a virtual URI built by {@link virtualUri}. */
export function originalUriString(virtual: vscode.Uri): string {
	return decodeURIComponent(
		virtual.path.replace(/^\//, '').replace(/\.(ts|css)$/, ''),
	);
}

// ---------------------------------------------------------------------------
// Virtual document content provider
// ---------------------------------------------------------------------------

export class EmbeddedContentProvider
	implements vscode.TextDocumentContentProvider
{
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	public readonly onDidChange = this._onDidChange.event;

	/** Ambient globals appended to every JS virtual document (may be empty). */
	private globals = '';

	public setGlobals(text: string): void {
		this.globals = text;
	}

	/** Tell VS Code both virtual documents for `originalUri` are stale. */
	public invalidate(originalUri: vscode.Uri): void {
		this._onDidChange.fire(virtualUri(originalUri, 'javascript'));
		this._onDidChange.fire(virtualUri(originalUri, 'css'));
	}

	/**
	 * Open the virtual documents so the JS/TS and CSS services start loading
	 * before the first hover / completion – embedded language services have a
	 * noticeable cold start otherwise.
	 */
	public warmUp(document: vscode.TextDocument): void {
		if (embeddedRegionsOf(document).length === 0) {
			return;
		}
		for (const language of ['javascript', 'css'] as const) {
			void vscode.workspace
				.openTextDocument(virtualUri(document.uri, language))
				.then(undefined, () => undefined);
		}
	}

	public provideTextDocumentContent(uri: vscode.Uri): string {
		const language: EmbeddedLanguage =
			uri.scheme === SCHEME.css ? 'css' : 'javascript';
		const originalStr = originalUriString(uri);
		const doc = vscode.workspace.textDocuments.find(
			(d) => d.uri.toString() === originalStr,
		);
		if (!doc) {
			return '';
		}
		const text = doc.getText();
		return buildVirtualContent(
			text,
			language,
			scanEmbeddedRegions(text),
			language === 'javascript' ? { append: this.globals } : {},
		);
	}
}

// ---------------------------------------------------------------------------
// Forwarding providers
// ---------------------------------------------------------------------------

export class EmbeddedHoverProvider implements vscode.HoverProvider {
	public async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Hover | undefined> {
		const region = active(document, position);
		if (!region) {
			return undefined;
		}
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			'vscode.executeHoverProvider',
			virtualUri(document.uri, region.language),
			position,
		);
		if (token.isCancellationRequested || !hovers || hovers.length === 0) {
			return undefined;
		}
		const contents = hovers.flatMap((h) => h.contents);
		return contents.length
			? new vscode.Hover(contents, hovers[0].range)
			: undefined;
	}
}

export class EmbeddedCompletionProvider
	implements vscode.CompletionItemProvider
{
	/** `@default`s of the JS declarations, see {@link withDeclarationDefault}. */
	private defaults: DeclarationDefaults = new Map();

	public setDeclarationDefaults(defaults: DeclarationDefaults): void {
		this.defaults = defaults;
	}

	public async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): Promise<vscode.CompletionList | undefined> {
		const region = active(document, position);
		if (!region) {
			return undefined;
		}
		const list =
			await vscode.commands.executeCommand<vscode.CompletionList>(
				'vscode.executeCompletionItemProvider',
				virtualUri(document.uri, region.language),
				position,
				context.triggerCharacter,
				50,
			);
		if (token.isCancellationRequested || !list) {
			return undefined;
		}
		let items = list.items.map(sanitizeCompletionItem);
		if (region.language === 'javascript' && this.defaults.size > 0) {
			const offset = document.offsetAt(position);
			const suffix = document
				.lineAt(position.line)
				.text.slice(position.character);
			const slot = propertySlot(
				document
					.getText()
					.slice(Math.max(region.start, offset - 4000), offset),
				suffix,
			);
			if (slot) {
				const semicolon = !/^[\w$]*\s*;/.test(suffix);
				items = items.map((it) =>
					withDeclarationDefault(it, this.defaults, slot, semicolon),
				);
			}
		}
		return new vscode.CompletionList(items, list.isIncomplete);
	}
}

/**
 * An option property gets its documented `@default` inserted, selected
 * (typing replaces it, Tab keeps it): `name: default` as an object-literal
 * key, `name = default;` as the end of a member chain that starts a statement
 * (see {@link propertySlot}). Items without a known default are left alone.
 */
export function withDeclarationDefault(
	item: vscode.CompletionItem,
	defaults: DeclarationDefaults,
	slot: 'key' | 'assign' = 'key',
	semicolon = true,
): vscode.CompletionItem {
	if (
		item.kind !== vscode.CompletionItemKind.Field &&
		item.kind !== vscode.CompletionItemKind.Property
	) {
		return item;
	}
	const label =
		typeof item.label === 'string' ? item.label : item.label.label;
	const d = lookupDefault(defaults, label.replace(/\?$/, ''), item.detail);
	if (d) {
		item.insertText = new vscode.SnippetString(
			slot === 'key'
				? propertySnippet(d)
				: assignmentSnippet(d, semicolon),
		);
	}
	return item;
}

export class EmbeddedSignatureProvider implements vscode.SignatureHelpProvider {
	public async provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.SignatureHelpContext,
	): Promise<vscode.SignatureHelp | null> {
		const region = active(document, position);
		if (!region) {
			return null;
		}
		const help = await vscode.commands.executeCommand<vscode.SignatureHelp>(
			'vscode.executeSignatureHelpProvider',
			virtualUri(document.uri, region.language),
			position,
			context.triggerCharacter,
		);
		return token.isCancellationRequested ? null : (help ?? null);
	}
}

/** Region under the cursor, or `undefined` when the feature is off / outside. */
function active(
	document: vscode.TextDocument,
	position: vscode.Position,
): EmbeddedRegion | undefined {
	if (!embeddedLanguagesEnabled()) {
		return undefined;
	}
	return embeddedRegionAt(document, position);
}

/**
 * An embedded snippet is not a module – auto-import edits and their "apply
 * code action" command would corrupt the `.q` file. Drop them; keep the
 * harmless re-trigger command.
 */
export function sanitizeCompletionItem(
	item: vscode.CompletionItem,
): vscode.CompletionItem {
	item.additionalTextEdits = undefined;
	if (
		item.command &&
		item.command.command !== 'editor.action.triggerParameterHints'
	) {
		item.command = undefined;
	}
	return item;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Wire up the embedded-language support: the virtual-document content provider,
 * the three forwarding providers and the cache/warm-up bookkeeping. Safe to
 * call once from `activate` even when the feature is disabled – the providers
 * then simply never match (see {@link active}).
 */
export function registerEmbeddedLanguageSupport(
	context: vscode.ExtensionContext,
): { reloadDeclarations(): void } {
	const content = new EmbeddedContentProvider();
	const completion = new EmbeddedCompletionProvider();
	const builtIn = loadEmbeddedGlobals(context.extensionUri);
	let watchers: vscode.Disposable[] = [];
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * (Re)read `gessq.embeddedLanguages.declarationFiles`, append them to the
	 * built-in globals, re-arm the file watchers and refresh every open
	 * virtual document.
	 */
	const reloadDeclarations = (): void => {
		for (const w of watchers) {
			w.dispose();
		}
		watchers = [];
		const user = loadUserDeclarations(
			embeddedDeclarationFiles(),
			vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
			os.homedir(),
		);
		const globals = user.text ? builtIn + '\n' + user.text : builtIn;
		content.setGlobals(globals);
		completion.setDeclarationDefaults(parseDeclarationDefaults(globals));
		// Editors save in several steps – coalesce the burst into one reload.
		const scheduleReload = (): void => {
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(reloadDeclarations, 200);
		};
		for (const { dir, pattern } of user.watch) {
			const w = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(vscode.Uri.file(dir), pattern),
			);
			w.onDidCreate(scheduleReload);
			w.onDidChange(scheduleReload);
			w.onDidDelete(scheduleReload);
			watchers.push(w);
		}
		for (const d of vscode.workspace.textDocuments) {
			if (d.languageId === 'gessq') {
				content.invalidate(d.uri);
			}
		}
	};
	reloadDeclarations();

	context.subscriptions.push(
		{
			dispose: () => {
				clearTimeout(reloadTimer);
				for (const w of watchers) {
					w.dispose();
				}
			},
		},
		vscode.workspace.registerTextDocumentContentProvider(
			SCHEME.javascript,
			content,
		),
		vscode.workspace.registerTextDocumentContentProvider(
			SCHEME.css,
			content,
		),
		vscode.languages.registerHoverProvider(
			SELECTOR,
			new EmbeddedHoverProvider(),
		),
		vscode.languages.registerCompletionItemProvider(
			SELECTOR,
			completion,
			'.',
			'"',
			"'",
			'(',
			':',
			'-',
			'$',
			'@',
			'/',
		),
		vscode.languages.registerSignatureHelpProvider(
			SELECTOR,
			new EmbeddedSignatureProvider(),
			'(',
			',',
		),
		vscode.workspace.onDidOpenTextDocument((d) => {
			if (d.languageId === 'gessq') {
				content.warmUp(d);
			}
		}),
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.languageId === 'gessq') {
				forgetRegions(e.document.uri);
				content.invalidate(e.document.uri);
			}
		}),
		vscode.workspace.onDidCloseTextDocument((d) => forgetRegions(d.uri)),
	);

	// A `.q` file already open when the extension activates (window reload).
	for (const d of vscode.workspace.textDocuments) {
		if (d.languageId === 'gessq') {
			content.warmUp(d);
		}
	}

	return { reloadDeclarations };
}
