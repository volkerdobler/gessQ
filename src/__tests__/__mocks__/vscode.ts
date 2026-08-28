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

export class Position {
	constructor(
		public readonly line: number,
		public readonly character: number,
	) {}
}

export class Range {
	constructor(
		public readonly start: Position,
		public readonly end: Position,
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
