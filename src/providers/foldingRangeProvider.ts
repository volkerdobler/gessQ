'use strict';

import * as vscode from 'vscode';

/**
 * Folding for `#macro`/`#endmacro`, `#ifdef`/`#endif`, `{ … }` blocks and
 * `/* … *\/` block comments.
 */
export class GessQFoldingRangeProvider implements vscode.FoldingRangeProvider {
	public provideFoldingRanges(
		document: vscode.TextDocument,
		_context: vscode.FoldingContext,
		_token: vscode.CancellationToken,
	): Thenable<vscode.FoldingRange[]> {
		return new Promise((resolve) => {
			const regions: {
				start: RegExp;
				end: RegExp;
				kind: vscode.FoldingRangeKind;
				len: number;
			}[] = [
				{
					start: /\B#macro\b/i,
					end: /\B#(endmacro|macroend)\b/i,
					kind: vscode.FoldingRangeKind.Region,
					len: 6,
				},
				{
					start: /\B#ifn?def\b/i,
					end: /\B#end(if)?\b/i,
					kind: vscode.FoldingRangeKind.Region,
					len: 4,
				},
				{
					start: /\{/i,
					end: /\}/,
					kind: vscode.FoldingRangeKind.Region,
					len: 1,
				},
				{
					start: /\B\/\*\B/,
					end: /\B\*\/\B/,
					kind: vscode.FoldingRangeKind.Comment,
					len: 2,
				},
			];

			const foldingCollection: {
				start: number;
				end: number;
				kind: vscode.FoldingRangeKind;
			}[] = [];

			let foldingCounter = 0;
			let inComment = false;

			for (let l = 0; l < document.lineCount; l++) {
				let curLine = document.lineAt(l).text;

				const posLineComment = curLine.search(/\/\//);
				if (posLineComment > -1) {
					curLine = curLine.slice(0, posLineComment);
					if (curLine.length === 0) {
						continue;
					}
				}
				for (let loop = 0; loop < regions.length; loop++) {
					if (curLine.length === 0) {
						break;
					}

					if (curLine.search(/\}\s*else\s*\{/) > -1) {
						break;
					}
					let posRegionComplete = curLine.search(
						new RegExp(
							regions[loop].start.source +
								'.+?' +
								regions[loop].end.source,
							'i',
						),
					);

					while (posRegionComplete > -1) {
						curLine =
							curLine.slice(
								0,
								curLine.search(regions[loop].start),
							) +
							curLine.slice(
								curLine.search(regions[loop].end) +
									regions[loop].len,
							);
						posRegionComplete = curLine.search(
							new RegExp(
								regions[loop].start.source +
									'.+?' +
									regions[loop].end.source,
								'i',
							),
						);
					}
					const posStart = curLine.search(regions[loop].start);
					if (posStart > -1 && !inComment) {
						foldingCollection.push({
							start: l,
							end: -1,
							kind: regions[loop].kind,
						});
						foldingCounter = foldingCollection.length;
						curLine = curLine.slice(posStart + regions[loop].len);
						inComment =
							regions[loop].kind ===
							vscode.FoldingRangeKind.Comment;
					}
					const posEnd = curLine.search(regions[loop].end);
					if (
						posEnd > -1 &&
						(regions[loop].kind ===
							vscode.FoldingRangeKind.Comment ||
							!inComment)
					) {
						while (
							foldingCounter > 0 &&
							foldingCollection[foldingCounter - 1].end > -1
						) {
							foldingCounter--;
						}
						if (foldingCounter > 0) {
							const endLine =
								l - 1 >
								foldingCollection[foldingCounter - 1].start
									? l - 1
									: l;
							foldingCollection[--foldingCounter].end = endLine;
						}
						curLine = curLine.slice(posEnd + regions[loop].len + 1);
						inComment = false;
					}
				}
			}
			resolve(foldingCollection);
		});
	}
}
