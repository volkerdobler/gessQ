'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { getCachedScope } from './scope';
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

/**
 * Workspace-wide index of gessQ symbol definitions. Built once from
 * `workspace.findFiles` and kept current with a `FileSystemWatcher`, so the
 * navigation providers no longer rescan every `.q` file on each request.
 */
export class SymbolIndex {
	private readonly byFile = new Map<string, FileEntry>();
	private watcher: vscode.FileSystemWatcher | undefined;
	private refreshing: Promise<void> | undefined;

	/** Resolves once the initial scan has finished. */
	public get ready(): Promise<void> {
		return this.refreshing ?? Promise.resolve();
	}

	/** Start the initial scan and begin watching for changes. */
	public start(): void {
		this.refreshing = this.refresh();

		const watcher = vscode.workspace.createFileSystemWatcher('**/*.q');
		watcher.onDidCreate((uri) => void this.reindex(uri));
		watcher.onDidChange((uri) => void this.reindex(uri));
		watcher.onDidDelete((uri) => this.byFile.delete(uri.toString()));
		this.watcher = watcher;
	}

	public dispose(): void {
		this.watcher?.dispose();
		this.watcher = undefined;
		this.byFile.clear();
	}

	/** Re-run the full scan (e.g. after `gessq.files.exclude` changed). */
	public rebuild(): void {
		this.refreshing = this.refresh();
	}

	/** All indexed `.q` file URIs. */
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

	private async refresh(): Promise<void> {
		this.byFile.clear();
		const extra = filesExcludeGlob();
		const exclude = extra
			? '{**/node_modules/**,' + extra + '}'
			: '**/node_modules/**';
		let uris: vscode.Uri[];
		try {
			uris = await vscode.workspace.findFiles('**/*.q', exclude);
		} catch {
			return;
		}
		await Promise.all(uris.map((uri) => this.reindex(uri)));
		debug(
			'symbolIndex: ' +
				this.all().length +
				' symbols in ' +
				this.byFile.size +
				' files',
		);
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
