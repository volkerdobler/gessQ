/**
 * Minimal `vscode` API stub for unit tests run under jest (outside the
 * Extension Host). Only the members touched by unit-tested modules are
 * implemented; extend as needed.
 */

export enum FoldingRangeKind {
	Comment = 1,
	Imports = 2,
	Region = 3,
}

export enum SymbolKind {
	Function = 11,
	Variable = 12,
	Constant = 13,
	Module = 1,
	Property = 6,
	Operator = 25,
	Array = 17,
}

export enum CompletionItemKind {
	Keyword = 13,
	Function = 2,
	Property = 9,
	Module = 8,
	Constant = 20,
	Variable = 5,
	EnumMember = 19,
	Value = 11,
}

export enum DiagnosticSeverity {
	Error = 0,
	Warning = 1,
	Information = 2,
	Hint = 3,
}

export enum DocumentHighlightKind {
	Text = 0,
	Read = 1,
	Write = 2,
}

export class Position {
	constructor(
		public readonly line: number,
		public readonly character: number,
	) {}
	isEqual(other: Position): boolean {
		return this.line === other.line && this.character === other.character;
	}
}

export class Range {
	public readonly start: Position;
	public readonly end: Position;

	constructor(
		startLine: number | Position,
		startChar: number | Position,
		endLine?: number,
		endChar?: number,
	) {
		if (typeof startLine === 'number') {
			this.start = new Position(startLine, startChar as number);
			this.end = new Position(endLine as number, endChar as number);
		} else {
			this.start = startLine;
			this.end = startChar as Position;
		}
	}

	contains(pos: Position): boolean {
		const afterStart =
			pos.line > this.start.line ||
			(pos.line === this.start.line &&
				pos.character >= this.start.character);
		const beforeEnd =
			pos.line < this.end.line ||
			(pos.line === this.end.line && pos.character <= this.end.character);
		return afterStart && beforeEnd;
	}
}

export class Location {
	constructor(
		public readonly uri: unknown,
		public readonly range: Range,
	) {}
}

export class Diagnostic {
	source?: string;
	code?: string | number;
	constructor(
		public range: Range,
		public message: string,
		public severity: DiagnosticSeverity = DiagnosticSeverity.Error,
	) {}
}

export class DocumentHighlight {
	constructor(
		public range: Range,
		public kind: DocumentHighlightKind = DocumentHighlightKind.Text,
	) {}
}

export class CodeLens {
	command?: unknown;
	constructor(
		public range: Range,
		command?: unknown,
	) {
		this.command = command;
	}
}

export class DocumentLink {
	tooltip?: string;
	constructor(
		public range: Range,
		public target?: Uri,
	) {}
}

function normalize(p: string): string {
	const parts: string[] = [];
	for (const seg of p.split('/')) {
		if (seg === '' || seg === '.') {
			continue;
		}
		if (seg === '..') {
			parts.pop();
		} else {
			parts.push(seg);
		}
	}
	return '/' + parts.join('/');
}

export class Uri {
	private constructor(
		public readonly path: string,
		public readonly scheme: string = 'file',
		public readonly authority: string = '',
	) {}
	static file(p: string): Uri {
		return new Uri(normalize(p.replace(/\\/g, '/')));
	}
	static parse(p: string): Uri {
		return new Uri(normalize(p.replace(/^[a-z]+:\/\//i, '/')));
	}
	static joinPath(base: Uri, ...segments: string[]): Uri {
		return new Uri(normalize(base.path + '/' + segments.join('/')));
	}
	static from(c: { scheme: string; path?: string; authority?: string }): Uri {
		return new Uri(c.path ?? '', c.scheme, c.authority ?? '');
	}
	get fsPath(): string {
		return this.path;
	}
	toString(): string {
		return this.scheme === 'file'
			? 'file://' + this.path
			: this.scheme + '://' + this.authority + this.path;
	}
}

export class EventEmitter<T> {
	private readonly listeners: ((e: T) => void)[] = [];
	public readonly event = (listener: (e: T) => void): { dispose(): void } => {
		this.listeners.push(listener);
		return { dispose: () => void 0 };
	};
	fire(data: T): void {
		for (const l of this.listeners) {
			l(data);
		}
	}
	dispose(): void {
		this.listeners.length = 0;
	}
}

export class Hover {
	constructor(
		public contents: unknown,
		public range?: Range,
	) {}
}

export class MarkdownString {
	value = '';
	isTrusted: boolean | { enabledCommands: string[] } = false;
	constructor(value = '') {
		this.value = value;
	}
	appendMarkdown(v: string): this {
		this.value += v;
		return this;
	}
}

export class CompletionItem {
	detail?: string;
	documentation?: unknown;
	sortText?: string;
	filterText?: string;
	insertText?: unknown;
	range?: unknown;
	command?: unknown;
	additionalTextEdits?: unknown;
	constructor(
		public label: string | { label: string },
		public kind?: CompletionItemKind,
	) {}
}

export class CompletionList {
	constructor(
		public items: unknown[] = [],
		public isIncomplete = false,
	) {}
}

export class SignatureHelp {
	signatures: unknown[] = [];
	activeSignature = 0;
	activeParameter = 0;
}

/** Overridable in tests via `jest.spyOn` / direct assignment. */
export const workspace = {
	textDocuments: [] as unknown[],
	getConfiguration(): {
		get<T>(key: string, defaultValue?: T): T | undefined;
	} {
		return {
			get<T>(_key: string, defaultValue?: T): T | undefined {
				return defaultValue;
			},
		};
	},
	asRelativePath(uri: Uri | string): string {
		return typeof uri === 'string' ? uri : uri.path;
	},
	registerTextDocumentContentProvider(): { dispose(): void } {
		return { dispose: () => void 0 };
	},
	openTextDocument(): Promise<unknown> {
		return Promise.reject(new Error('not implemented in mock'));
	},
	onDidOpenTextDocument(): { dispose(): void } {
		return { dispose: () => void 0 };
	},
	onDidChangeTextDocument(): { dispose(): void } {
		return { dispose: () => void 0 };
	},
	onDidCloseTextDocument(): { dispose(): void } {
		return { dispose: () => void 0 };
	},
};

export const commands = {
	executeCommand: async (..._args: unknown[]): Promise<unknown> => undefined,
};

export const languages = {
	registerHoverProvider: () => ({ dispose: () => void 0 }),
	registerCompletionItemProvider: () => ({ dispose: () => void 0 }),
	registerSignatureHelpProvider: () => ({ dispose: () => void 0 }),
};

export const window = {
	createOutputChannel() {
		return {
			appendLine() {},
			dispose() {},
		};
	},
};
