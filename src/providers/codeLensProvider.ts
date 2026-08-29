'use strict';

import * as vscode from 'vscode';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';
import { findReferences } from '../core/symbolSearch';
import { codeLensEnabled } from '../infra/config';

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
 * A "N references" lens above every question / opennumformat / block / macro /
 * action-target definition. The count is computed lazily in `resolveCodeLens`.
 */
export class GessQCodeLensProvider implements vscode.CodeLensProvider {
	private readonly changed = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses = this.changed.event;

	constructor(private readonly index: SymbolIndex) {}

	/** Re-query lenses, e.g. after `gessq.codeLens.enable` changed. */
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
		if (token.isCancellationRequested || !codeLensEnabled()) {
			return [];
		}
		return parseDocumentSymbols(document).map(
			(s) => new SymbolCodeLens(s.nameRange, document.uri, s.name),
		);
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
