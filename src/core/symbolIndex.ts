'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { getCachedScope } from './scope';
import { parseIncludes, type IncludeDirective } from './includes';
import { includeClosure, isRootScript, ROOT_SCRIPT } from './projectFiles';
import { debug } from '../infra/logger';
import { filesExcludeGlob } from '../infra/config';

export type SymbolCategory =
	| 'question'
	| 'definition'
	| 'block'
	| 'macro'
	| 'action'
	| 'array'
	| 'quota';

export interface IndexedSymbol {
	/** Name as written, with surrounding quotes stripped. */
	name: string;
	/** `name` lower-cased, for case-insensitive matching. */
	lower: string;
	category: SymbolCategory;
	/** Concrete keyword, e.g. `singleq`, `block`, `macro`. */
	detail: string;
	uri: vscode.Uri;
	/** Precise range of the name token. */
	nameRange: vscode.Range;
	/** Whole definition line (used for peek). */
	lineRange: vscode.Range;
}

/** Map an index category to a VS Code {@link vscode.SymbolKind}. */
export function symbolKindOf(category: SymbolCategory): vscode.SymbolKind {
	switch (category) {
		case 'question':
			return vscode.SymbolKind.Function;
		case 'definition':
			return vscode.SymbolKind.Property;
		case 'block':
			return vscode.SymbolKind.Module;
		case 'macro':
			return vscode.SymbolKind.Constant;
		case 'action':
			return vscode.SymbolKind.Variable;
		case 'array':
			return vscode.SymbolKind.Array;
		case 'quota':
			return vscode.SymbolKind.Variable;
	}
}

const unquote = (s: string) =>
	(s.startsWith('"') && s.endsWith('"')) ||
	(s.startsWith("'") && s.endsWith("'"))
		? s.slice(1, -1)
		: s;

interface Factory {
	re: () => RegExp;
	category: SymbolCategory;
}

const FACTORIES: Factory[] = [
	{ re: () => parser.questionDefRe(), category: 'question' },
	{ re: () => parser.definitionDefRe(), category: 'definition' },
	{ re: () => parser.blockDefRe(), category: 'block' },
	{ re: () => parser.macroDefRe(), category: 'macro' },
	{ re: () => parser.actionDefRe(), category: 'action' },
	{ re: () => parser.arrayDefRe(), category: 'array' },
	{ re: () => parser.quotavarDefRe(), category: 'quota' },
	{ re: () => parser.quotagroupDefRe(), category: 'quota' },
	{ re: () => parser.computeDefRe(), category: 'definition' },
	{ re: () => parser.textArrayDefRe(), category: 'array' },
	{ re: () => parser.textElementDefRe(), category: 'definition' },
	{ re: () => parser.intRandomDefRe(), category: 'definition' },
	{ re: () => parser.databaseConnectionDefRe(), category: 'definition' },
];

/**
 * Parse a single document into the symbols it *defines* (questions,
 * opennumformats, blocks/screens, macros). Comment-only matches are skipped.
 */
export function parseDocumentSymbols(
	document: vscode.TextDocument,
): IndexedSymbol[] {
	const out: IndexedSymbol[] = [];

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		if (text.length === 0) {
			continue;
		}

		for (const { re, category } of FACTORIES) {
			const m = re().exec(text);
			if (!m || m.index < 0 || !m[2]) {
				continue;
			}
			if (!getCachedScope(document).isNotInComment(i, m.index)) {
				continue;
			}
			const token = m[2];
			const start = text.indexOf(token, m.index);
			if (start < 0) {
				continue;
			}
			const name = unquote(token);
			out.push({
				name,
				lower: name.toLowerCase(),
				category,
				detail: m[1].toLowerCase(),
				uri: document.uri,
				nameRange: new vscode.Range(i, start, i, start + token.length),
				lineRange: document.lineAt(i).range,
			});
		}
	}

	return out;
}

interface FileEntry {
	uri: vscode.Uri;
	symbols: IndexedSymbol[];
}

const REFRESH_DEBOUNCE_MS = 200;

/**
 * Index of GESS Q. symbol definitions for the current *project*.
 *
 * The project is not "every `.q` file around" – it is `script.q` plus its
 * transitive `#include` / `#includeifexists` closure (see
 * {@link ./projectFiles}). Concretely:
 *
 * - **workspace open** – every `script.q` in the workspace and everything it
 *   includes;
 * - **no workspace, `script.q` next to the active `.q` file** – that
 *   `script.q` and its closure;
 * - **otherwise** – just the active `.q` document and its own includes.
 *
 * Kept current with a `**\/*.q` file-system watcher, document saves and (when
 * there is no workspace) the active editor.
 */
export class SymbolIndex {
	private readonly byFile = new Map<string, FileEntry>();
	private watcher: vscode.FileSystemWatcher | undefined;
	private readonly subs: vscode.Disposable[] = [];
	private refreshing: Promise<void> | undefined;
	private refreshTimer: ReturnType<typeof setTimeout> | undefined;
	private cachedRoots: vscode.Uri[] | undefined;
	private activeQDoc: vscode.Uri | undefined;

	/** Resolves once the current (re)scan has finished. */
	public get ready(): Promise<void> {
		return this.refreshing ?? Promise.resolve();
	}

	/** Start the initial scan and begin watching for changes. */
	public start(): void {
		this.captureActiveDoc();
		this.refreshing = this.refresh(true);

		const watcher = vscode.workspace.createFileSystemWatcher('**/*.q');
		// A new / deleted file may add or remove a `script.q` or an include
		// target, so the root set has to be rediscovered.
		watcher.onDidCreate(() => this.scheduleRefresh(true));
		watcher.onDidDelete(() => this.scheduleRefresh(true));
		// A content change can only alter include lists – reuse the roots.
		watcher.onDidChange(() => this.scheduleRefresh(false));
		this.watcher = watcher;

		this.subs.push(
			vscode.window.onDidChangeActiveTextEditor(() => {
				// Without a workspace the project is anchored to the active
				// document's folder, so a switch may change everything.
				if (this.captureActiveDoc() && !this.hasWorkspace()) {
					this.scheduleRefresh(true);
				}
			}),
			vscode.workspace.onDidSaveTextDocument((d) => {
				if (d.languageId === 'gessq') {
					this.scheduleRefresh(false);
				}
			}),
		);
	}

	public dispose(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = undefined;
		}
		this.watcher?.dispose();
		this.watcher = undefined;
		for (const s of this.subs) {
			s.dispose();
		}
		this.subs.length = 0;
		this.cachedRoots = undefined;
		this.byFile.clear();
	}

	/** Re-run the full scan (e.g. after `gessq.files.exclude` changed). */
	public rebuild(): void {
		this.refreshing = this.refresh(true);
	}

	/** All indexed `.q` file URIs (the project files). */
	public files(): vscode.Uri[] {
		return [...this.byFile.values()].map((e) => e.uri);
	}

	/** All definitions whose name equals `word` (case-insensitive). */
	public definitionsOf(word: string): IndexedSymbol[] {
		const lower = word.toLowerCase();
		return this.all().filter((s) => s.lower === lower);
	}

	/**
	 * Definitions whose name contains `query` (case-insensitive). An empty
	 * query returns everything.
	 */
	public match(query: string): IndexedSymbol[] {
		const q = query.toLowerCase();
		return q.length === 0
			? this.all()
			: this.all().filter((s) => s.lower.includes(q));
	}

	private all(): IndexedSymbol[] {
		return [...this.byFile.values()].flatMap((e) => e.symbols);
	}

	private hasWorkspace(): boolean {
		return (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
	}

	/**
	 * Remember the active `.q` document (used to anchor the project when there
	 * is no workspace). Returns `true` when it changed.
	 */
	private captureActiveDoc(): boolean {
		const ed = vscode.window.activeTextEditor;
		const uri =
			ed?.document.languageId === 'gessq' ? ed.document.uri : undefined;
		if (!uri) {
			return false;
		}
		const changed = this.activeQDoc?.toString() !== uri.toString();
		this.activeQDoc = uri;
		return changed;
	}

	private scheduleRefresh(rediscoverRoots: boolean): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined;
			this.refreshing = this.refresh(rediscoverRoots);
		}, REFRESH_DEBOUNCE_MS);
	}

	private async refresh(rediscoverRoots: boolean): Promise<void> {
		let files: vscode.Uri[] = [];
		try {
			files = await this.resolveProjectFiles(rediscoverRoots);
		} catch {
			/* leave `files` empty */
		}

		this.byFile.clear();
		await Promise.all(files.map((uri) => this.reindex(uri)));
		debug(
			'symbolIndex: ' +
				this.all().length +
				' symbols in ' +
				this.byFile.size +
				' project files',
		);
	}

	private async resolveProjectFiles(
		rediscoverRoots: boolean,
	): Promise<vscode.Uri[]> {
		const read = (uri: vscode.Uri) => this.readIncludes(uri);

		if (rediscoverRoots || this.cachedRoots === undefined) {
			this.cachedRoots = await this.findRootScripts();
		}

		if (this.cachedRoots.length > 0) {
			return includeClosure(this.cachedRoots, read);
		}
		// No `script.q` reachable – index just the active document's closure.
		return this.activeQDoc
			? includeClosure([this.activeQDoc], read)
			: [];
	}

	/** Every `script.q` that anchors the project, or `[]` when there is none. */
	private async findRootScripts(): Promise<vscode.Uri[]> {
		if (this.hasWorkspace()) {
			try {
				const hits = await vscode.workspace.findFiles(
					'**/' + ROOT_SCRIPT,
					this.excludeGlob(),
				);
				return hits.filter(isRootScript);
			} catch {
				return [];
			}
		}
		// No workspace: a `script.q` sitting next to the active `.q` file.
		if (!this.activeQDoc) {
			return [];
		}
		const candidate = vscode.Uri.joinPath(
			this.activeQDoc,
			'..',
			ROOT_SCRIPT,
		);
		try {
			await vscode.workspace.fs.stat(candidate);
			return [candidate];
		} catch {
			return [];
		}
	}

	private excludeGlob(): string {
		const extra = filesExcludeGlob();
		return extra
			? '{**/node_modules/**,' + extra + '}'
			: '**/node_modules/**';
	}

	private async readIncludes(
		uri: vscode.Uri,
	): Promise<IncludeDirective[] | undefined> {
		try {
			const doc = await vscode.workspace.openTextDocument(uri);
			return parseIncludes(doc);
		} catch {
			return undefined;
		}
	}

	private async reindex(uri: vscode.Uri): Promise<void> {
		try {
			const doc = await vscode.workspace.openTextDocument(uri);
			this.byFile.set(uri.toString(), {
				uri,
				symbols: parseDocumentSymbols(doc),
			});
		} catch {
			this.byFile.delete(uri.toString());
		}
	}
}
