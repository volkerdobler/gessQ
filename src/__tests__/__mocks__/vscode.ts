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
}

export enum CompletionItemKind {
	Keyword = 13,
	Function = 2,
	Property = 9,
	Module = 8,
	Constant = 20,
	Variable = 5,
}

export class Position {
	constructor(
		public readonly line: number,
		public readonly character: number,
	) {}
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
}

export class Location {
	constructor(
		public readonly uri: unknown,
		public readonly range: Range,
	) {}
}

export const workspace = {
	getConfiguration() {
		return {
			get<T>(_key: string, defaultValue?: T): T | undefined {
				return defaultValue;
			},
		};
	},
};

export const window = {
	createOutputChannel() {
		return {
			appendLine() {},
			dispose() {},
		};
	},
};
