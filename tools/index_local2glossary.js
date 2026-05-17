const fs = require('fs');
const path = require('path');
const base = 'https://help.gessgroup.de/q-help/';

function normalizeKey(s) {
	return s
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g;
let m;
const map = Object.create(null);
while ((m = re.exec(html)) !== null) {
	let href = m[1].trim();
	const label = m[2].replace(/<[^>]+>/g, '').trim();
	if (!href || href.startsWith('javascript:')) continue;
	if (!href.startsWith('http')) {
		href = new URL(href, base).toString();
	}
	const key = normalizeKey(label || href);
	if (!map[key]) map[key] = { short: label, detail: href };
}
fs.writeFileSync(
	'src/commons/manualGlossary.json',
	JSON.stringify(map, null, 2),
	'utf8',
);
console.log(
	'Wrote',
	Object.keys(map).length,
	'entries to src/commons/manualGlossary.json',
);
