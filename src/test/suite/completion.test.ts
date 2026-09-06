import * as assert from 'node:assert';
import { activate, openFixture, completionLabels } from './helpers';

suite('completion', () => {
	suiteSetup(async function () {
		this.timeout(60000);
		await activate();
	});

	test('default context offers language keywords', async () => {
		const doc = await openFixture('questions.q');
		const text = doc.getText();
		const labels = await completionLabels(
			doc.uri,
			doc.positionAt(text.indexOf('singleq alter') + 3),
		);
		assert.ok(labels.includes('singleq'), 'no keywords offered');
		assert.ok(labels.includes('compute'), 'keyword list incomplete');
	});

	test('after `#` only preprocessor directives', async () => {
		const doc = await openFixture('script.q');
		const text = doc.getText();
		// just after the `#` of an existing `#include`
		const pos = doc.positionAt(text.indexOf('#include') + 1);
		const labels = await completionLabels(doc.uri, pos, '#');
		assert.ok(labels.includes('include'), labels.slice(0, 10).join(','));
		assert.ok(labels.includes('ifdef'));
		assert.ok(!labels.includes('singleq'));
	});

	test('QNAME eq … → that question’s answer codes (5.2)', async () => {
		const doc = await openFixture('labels.q');
		const text = doc.getText();
		const pos = doc.positionAt(
			text.indexOf('folgefrage eq 1') + 'folgefrage eq '.length,
		);
		const labels = await completionLabels(doc.uri, pos);
		const codes = labels.filter((l) => /^\d+$/.test(l)).sort();
		assert.deepStrictEqual(codes, ['1', '10', '2'].sort());
	});

	test('inside labels= → label attributes, not the full keyword set (5.2)', async () => {
		const doc = await openFixture('labels.q');
		const text = doc.getText();
		const inList = doc.positionAt(
			text.indexOf('1 "Audi" ') + '1 "Audi" '.length,
		);
		const listLabels = await completionLabels(doc.uri, inList);
		assert.ok(
			['random', 'single', 'fixed'].every((a) => listLabels.includes(a)),
			'attributes missing: ' + listLabels.join(','),
		);
		// `compute` is a language keyword (offered in the default context) but
		// not a label attribute and not a snippet prefix.
		assert.ok(
			!listLabels.includes('compute'),
			'compute leaked into the label list',
		);
		const defaultLabels = await completionLabels(
			doc.uri,
			doc.positionAt(text.indexOf('singleq nurjung') + 3),
		);
		assert.ok(defaultLabels.includes('compute'), 'default context broken');
	});
});
