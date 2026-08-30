'use strict';

import * as vscode from 'vscode';
import {
	SymbolIndex,
	parseDocumentSymbols,
	type IndexedSymbol,
} from '../core/symbolIndex';
import { findReferences } from '../core/symbolSearch';
import {
	codeLensDefinitions,
	type CodeLensDefinitions,
} from '../infra/config';

/**
 * Whether a "N references" CodeLens applies to `s` at the configured level.
 * `set`/`load` assignment targets never get one (they repeat by design).
 */
export function lensApplies(
	level: Exclude<CodeLensDefinitions, 'off'>,
	s: IndexedSymbol,
): boolean {
	if (s.category === 'action') {
		return false;
	}
	if (level === 'all') {
		return true;
	}
	if (s.category === 'question') {
		return true;
	}
	if (level === 'questions') {
		return false;
	}
	// level === 'reusable'
	return (
		s.category === 'block' ||
		s.category === 'macro' ||
		s.category === 'quota' ||
		(s.category === 'definition' && s.detail === 'opennumformat')
	);
}

class SymbolCodeLens extends vscode.CodeLens {
	constructor(
		range: vscode.Range,
		public readonly uri: vscode.Uri,
		public readonly word: string,
	) {
		super(range);
	}
}

/**
 * A "N references" lens above definitions, filtered by
 * `gessq.codeLens.definitions` (see {@link lensApplies}). The count is computed
 * lazily in `resolveCodeLens`.
 */
export class GessQCodeLensProvider implements vscode.CodeLensProvider {
	private readonly changed = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses = this.changed.event;

	constructor(private readonly index: SymbolIndex) {}

	/** Re-query lenses, e.g. after `gessq.codeLens.definitions` changed. */
	public refresh(): void {
		this.changed.fire();
	}

	public dispose(): void {
		this.changed.dispose();
	}

	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): vscode.CodeLens[] {
		const level = codeLensDefinitions();
		if (token.isCancellationRequested || level === 'off') {
			return [];
		}
		return parseDocumentSymbols(document)
			.filter((s) => lensApplies(level, s))
			.map((s) => new SymbolCodeLens(s.nameRange, document.uri, s.name));
	}

	public async resolveCodeLens(
		lens: vscode.CodeLens,
		token: vscode.CancellationToken,
	): Promise<vscode.CodeLens> {
		if (!(lens instanceof SymbolCodeLens)) {
			return lens;
		}
		await this.index.ready;
		if (token.isCancellationRequested) {
			return lens;
		}

		const seen = new Set<string>();
		const files: vscode.Uri[] = [];
		for (const uri of [lens.uri, ...this.index.files()]) {
			const key = uri.toString();
			if (!seen.has(key)) {
				seen.add(key);
				files.push(uri);
			}
		}

		const refs = await findReferences(files, lens.word, token);
		const others = refs.filter(
			(r) =>
				!(
					r.uri.toString() === lens.uri.toString() &&
					r.range.start.isEqual(lens.range.start)
				),
		);

		lens.command = {
			title:
				others.length === 1
					? '1 reference'
					: others.length + ' references',
			command: 'editor.action.showReferences',
			arguments: [lens.uri, lens.range.start, others],
		};
		return lens;
	}
}
