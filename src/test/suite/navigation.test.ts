import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { activate, openFixture, hoverText } from './helpers';

suite('symbols & navigation', () => {
	suiteSetup(async function () {
		this.timeout(60000);
		await activate();
	});

	test('document symbols list the questions of a file', async () => {
		const doc = await openFixture('questions.q');
		const syms = await vscode.commands.executeCommand<
			vscode.DocumentSymbol[]
		>('vscode.executeDocumentSymbolProvider', doc.uri);
		const names = flatten(syms ?? []).map((s) => s.name);
		assert.ok(names.includes('alter'), names.join(', '));
		assert.ok(names.includes('marken'), names.join(', '));
		assert.ok(names.includes('onf_pct'), names.join(', '));
	});

	test('go to definition follows a reference across #include', async () => {
		const doc = await openFixture('labels.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('alter eq 2') + 2);
		const locs = await vscode.commands.executeCommand<vscode.Location[]>(
			'vscode.executeDefinitionProvider',
			doc.uri,
			pos,
		);
		assert.ok(locs && locs.length > 0, 'no definition found');
		assert.ok(
			locs[0].uri.path.endsWith('questions.q'),
			locs[0].uri.toString(),
		);
	});

	test('find all references of a question', async () => {
		const doc = await openFixture('questions.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('multiq marken') + 7);
		const refs = await vscode.commands.executeCommand<vscode.Location[]>(
			'vscode.executeReferenceProvider',
			doc.uri,
			pos,
		);
		// definition + `2 in marken` in zufrieden's flt
		assert.ok((refs ?? []).length >= 2, 'refs=' + (refs ?? []).length);
	});

	test('hover: keyword → glossary, symbol reference → the definition card', async () => {
		const doc = await openFixture('questions.q');
		const text = doc.getText();

		let pos = doc.positionAt(text.indexOf('singleq alter') + 2);
		let md = hoverText(
			await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				doc.uri,
				pos,
			),
		);
		assert.ok(/singleq/i.test(md), 'keyword hover: ' + md);

		pos = doc.positionAt(text.indexOf('2 in marken') + 5);
		md = hoverText(
			await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				doc.uri,
				pos,
			),
		);
		assert.ok(/marken/i.test(md), 'reference hover: ' + md);
	});

	test('workspace symbol search finds project definitions', async () => {
		await openFixture('questions.q');
		const syms = await vscode.commands.executeCommand<
			vscode.SymbolInformation[]
		>('vscode.executeWorkspaceSymbolProvider', 'marken');
		assert.ok((syms ?? []).some((s) => s.name === 'marken'));
	});
});

function flatten(syms: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
	return syms.flatMap((s) => [s, ...flatten(s.children ?? [])]);
}
