import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
	activate,
	openFixture,
	hoverText,
	completionLabels,
	retry,
} from './helpers';

/**
 * 5.13 – hover / completion / signature help forwarded from `javascript = "…"`
 * and `css = "…"` blocks to the built-in JS/TS and CSS language services. The
 * embedded services warm up lazily, hence the retries.
 */
suite('embedded JS / CSS', () => {
	suiteSetup(async function () {
		this.timeout(60000);
		await activate();
	});

	test('JS hover resolves a bundled global (QDot)', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('QDot.onSubmit') + 1);
		const md = await retry(
			async () =>
				hoverText(
					await vscode.commands.executeCommand<vscode.Hover[]>(
						'vscode.executeHoverProvider',
						doc.uri,
						pos,
					),
				),
			(m) => /QDot/.test(m),
		);
		assert.ok(/QDotApi/.test(md), md);
	});

	test('JS hover resolves a bundled function global', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(
			text.indexOf('startBackgroundAudioRecording') + 3,
		);
		const md = await retry(
			async () =>
				hoverText(
					await vscode.commands.executeCommand<vscode.Hover[]>(
						'vscode.executeHoverProvider',
						doc.uri,
						pos,
					),
				),
			(m) => /startBackgroundAudioRecording/.test(m),
		);
		assert.ok(/filename/i.test(md), md);
	});

	test('JS completion offers real Array members after `.`', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('xs.map') + 3);
		const labels = await retry(
			() => completionLabels(doc.uri, pos, '.'),
			(ls) => ls.includes('map'),
		);
		assert.ok(
			labels.includes('map') && labels.includes('forEach'),
			labels.slice(0, 20).join(','),
		);
	});

	test('JS signature help inside a call', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(
			text.indexOf('n.toFixed(') + 'n.toFixed('.length,
		);
		const sig = await retry(
			async () => {
				const help =
					await vscode.commands.executeCommand<vscode.SignatureHelp>(
						'vscode.executeSignatureHelpProvider',
						doc.uri,
						pos,
					);
				return help?.signatures?.[0]?.label ?? '';
			},
			(s) => /toFixed/.test(s),
		);
		assert.ok(/toFixed/.test(sig), sig);
	});

	test('CSS property completion inside css="…"', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('text-align') + 5);
		const labels = await retry(
			() => completionLabels(doc.uri, pos, '-'),
			(ls) => ls.some((l) => /^text-align$/.test(l)),
		);
		assert.ok(
			labels.some((l) => /^text-align$/.test(l)),
			labels.join(','),
		);
	});

	test('GESS Q. keyword completion is suppressed inside a JS block', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('QDot.onSubmit') + 2);
		const labels = await completionLabels(doc.uri, pos);
		assert.ok(
			!labels.includes('singleq') && !labels.includes('multiq'),
			'GESS Q. keywords leaked: ' + labels.slice(0, 20).join(','),
		);
	});

	test('GESS Q. hover still works outside the blocks', async () => {
		const doc = await openFixture('embedded.q');
		const text = doc.getText();
		const pos = doc.positionAt(text.indexOf('textq scriptq') + 2);
		const md = hoverText(
			await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				doc.uri,
				pos,
			),
		);
		assert.ok(/textq/i.test(md), md);
	});
});
