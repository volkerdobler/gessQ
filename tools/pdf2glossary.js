#!/usr/bin/env node
'use strict';

// Simple PDF -> glossary JSON extractor using `pdf-parse`.
// Usage: node tools/pdf2glossary.js path/to/manual.pdf out/glossary.json

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 2) {
		console.error(
			'Usage: node tools/pdf2glossary.js <input.pdf> <out.json>',
		);
		process.exit(2);
	}
	const input = args[0];
	const outJson = args[1];

	if (!fs.existsSync(input)) {
		console.error('Input PDF not found:', input);
		process.exit(2);
	}

	const dataBuffer = fs.readFileSync(input);
	try {
		const data = await pdf(dataBuffer);
		const text = data.text || '';

		// Save raw text for debugging
		const rawOut = outJson.replace(/\.json$/i, '.txt');
		fs.writeFileSync(rawOut, text, 'utf8');
		console.log('Wrote raw text to', rawOut);

		// Heuristic: find lines that look like `token - description` or `token: description`
		const lines = text.split(/\r?\n/);
		const glossary = {};

		const tokenLineRe =
			/^\s*([A-Za-zÄÖÜäöüß][A-Za-z0-9_\-]*)\s*[-:\u2013\u2014]\s*(.+)$/;

		for (let i = 0; i < lines.length; i++) {
			const ln = lines[i].trim();
			const m = ln.match(tokenLineRe);
			if (m) {
				const key = m[1].toLowerCase();
				const desc = m[2].trim();
				if (!glossary[key]) {
					glossary[key] = {
						short: desc.split(/[\.\n]/)[0].slice(0, 120),
						detail: desc,
					};
				}
			}
		}

		// Fallback: also collect single words that appear as headings (all lowercase words in their own line)
		if (Object.keys(glossary).length === 0) {
			for (let i = 0; i < lines.length; i++) {
				const ln = lines[i].trim();
				if (/^[a-zäöüß][a-z0-9_\-]{2,}$/.test(ln)) {
					const key = ln.toLowerCase();
					const next = (lines[i + 1] || '').trim();
					if (next.length > 0 && next.length < 400) {
						glossary[key] = {
							short: next.split(/[\.\n]/)[0].slice(0, 120),
							detail: next,
						};
					}
				}
			}
		}

		fs.writeFileSync(outJson, JSON.stringify(glossary, null, 2), 'utf8');
		console.log(
			'Wrote glossary to',
			outJson,
			'entries:',
			Object.keys(glossary).length,
		);
	} catch (e) {
		console.error('Error parsing PDF:', e && e.message ? e.message : e);
		process.exit(1);
	}
}

main();
