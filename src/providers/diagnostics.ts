'use strict';

import * as vscode from 'vscode';
import { SymbolIndex, parseDocumentSymbols } from '../core/symbolIndex';
import { lintDocument, lintIncludes } from '../core/diagnostics';
import { isNotInCommentAt } from '../core/scope';
import { diagnosticsEnabled } from '../infra/config';

const DEBOUNCE_MS = 400;

/**
 * Owns the gessQ `DiagnosticCollection` and (re)lints documents on open,
 * edit (debounced) and save. Honours `gessq.diagnostics.enable`.
 */
export class DiagnosticsManager {
	private readonly collection =
		vscode.languages.createDiagnosticCollection('gessq');
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(private readonly index: SymbolIndex) {}

	public activate(context: vscode.ExtensionContext): void {
		context.subscriptions.push(this.collection, {
			dispose: () => {
				for (const t of this.timers.values()) {
					clearTimeout(t);
				}
				this.timers.clear();
			},
		});

		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument((d) => this.schedule(d, 0)),
			vscode.workspace.onDidChangeTextDocument((e) =>
				this.schedule(e.document, DEBOUNCE_MS),
			),
			vscode.workspace.onDidSaveTextDocument((d) => this.schedule(d, 0)),
			vscode.workspace.onDidCloseTextDocument((d) =>
				this.collection.delete(d.uri),
			),
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('gessq.diagnostics')) {
					this.refreshOpen();
				}
			}),
		);

		this.refreshOpen();
	}

	private refreshOpen(): void {
		for (const doc of vscode.workspace.textDocuments) {
			this.schedule(doc, 0);
		}
	}

	private schedule(document: vscode.TextDocument, delay: number): void {
		if (document.languageId !== 'gessq') {
			return;
		}
		const key = document.uri.toString();
		const existing = this.timers.get(key);
		if (existing) {
			clearTimeout(existing);
		}
		this.timers.set(
			key,
			setTimeout(() => {
				this.timers.delete(key);
				void this.run(document);
			}, delay),
		);
	}

	private async run(document: vscode.TextDocument): Promise<void> {
		if (!diagnosticsEnabled()) {
			this.collection.delete(document.uri);
			return;
		}

		const diags = [
			...lintDocument(document),
			...(await lintIncludes(document)),
			...this.checkDomacro(document),
		];
		this.collection.set(document.uri, diags);
	}

	/** `#domacro NAME` where NAME is not a known macro. */
	private checkDomacro(document: vscode.TextDocument): vscode.Diagnostic[] {
		const known = new Set<string>(this.allMacroNames());
		for (const s of parseDocumentSymbols(document)) {
			if (s.category === 'macro') {
				known.add(s.lower);
			}
		}

		const out: vscode.Diagnostic[] = [];
		const re = /(?<!\w)#domacro\s+([A-Za-zÄÖÜäöüß_$][\w$]*)/gi;
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				if (!isNotInCommentAt(document, line, m.index)) {
					continue;
				}
				if (!known.has(m[1].toLowerCase())) {
					const start = m.index + m[0].length - m[1].length;
					out.push(
						new vscode.Diagnostic(
							new vscode.Range(
								line,
								start,
								line,
								start + m[1].length,
							),
							`Unknown macro "${m[1]}"`,
							vscode.DiagnosticSeverity.Warning,
						),
					);
				}
			}
		}
		return out;
	}

	private allMacroNames(): string[] {
		return this.index
			.match('')
			.filter((s) => s.category === 'macro')
			.map((s) => s.lower);
	}
}
