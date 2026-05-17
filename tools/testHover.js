const fs = require('fs');
const path = require('path');
const glossaryPath = path.join(
	__dirname,
	'..',
	'src',
	'commons',
	'manualGlossary.json',
);
const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

function normalizeKey(s) {
	return (s || '')
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

const tests = [
	'#define',
	'AppendText',
	'Audioaufnahme',
	'BackButtonOnFinish',
	'appendtext (Textelement)',
	'@insert()',
	'insert',
	'CSV',
	'Exportformate: ASCII',
];

for (const t of tests) {
	const direct = (t || '').toLowerCase();
	const n = normalizeKey(t.replace(/[()@:,]/g, ' '));
	const r1 = glossary[direct];
	const r2 = glossary[n];
	console.log('---');
	console.log('Test:', t);
	console.log(
		' direct key:',
		direct,
		'->',
		r1 ? r1.short + ' | ' + r1.detail : 'NOT FOUND',
	);
	console.log(
		' norm key:  ',
		n,
		'->',
		r2 ? r2.short + ' | ' + r2.detail : 'NOT FOUND',
	);
}

console.log('\nTotal glossary entries:', Object.keys(glossary).length);
