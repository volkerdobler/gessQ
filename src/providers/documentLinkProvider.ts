'use strict';

import * as vscode from 'vscode';
import { parseIncludes } from '../core/includes';

/**
 * Turns the quoted path in `#include "…"` / `#includeifexists "…"` into a
 * clickable link that opens the referenced file.
 */
export class GessQDocumentLinkProvider implements vscode.DocumentLinkProvider {
	public provideDocumentLinks(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): vscode.DocumentLink[] {
		if (token.isCancellationRequested) {
			return [];
		}
		return parseIncludes(document).map((inc) => {
			const link = new vscode.DocumentLink(inc.targetRange, inc.resolved);
			link.tooltip = 'Open ' + inc.target;
			return link;
		});
	}
}
