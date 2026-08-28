const https = require('https');
const fs = require('fs');
const url = 'https://help.gessgroup.de/q-help/hmkwindex.html';

function normalizeKey(s) {
	return s
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-äöüß]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

https
	.get(url, (res) => {
		let body = '';
		res.on('data', (chunk) => (body += chunk));
		res.on('end', () => {
			// Try to match HTML anchors first, then fallback to markdown-style links
			const reHtml = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
			const reMd = /\[([^\]]+)\]\((https?:[^)]+)\)/g;
			const map = Object.create(null);
			let m;
			while ((m = reHtml.exec(body)) !== null) {
				const link = m[1].trim();
				const label = m[2].trim();
				// skip javascript:void links
				if (link.startsWith('javascript:')) continue;
				const key = normalizeKey(label || link);
				if (!map[key]) {
					map[key] = { short: label, detail: link };
				}
			}
			// fallback to markdown-style links if none found (or to capture additional references)
			while ((m = reMd.exec(body)) !== null) {
				const label = m[1].trim();
				const link = m[2].trim();
				if (link.startsWith('javascript:')) continue;
				const key = normalizeKey(label || link);
				if (!map[key]) {
					map[key] = { short: label, detail: link };
				}
			}
			const outPath =
				process.argv[2] || 'src/data/manualGlossary.json';
			fs.writeFileSync(outPath, JSON.stringify(map, null, 2), 'utf8');
			console.log(
				'Wrote',
				Object.keys(map).length,
				'entries to',
				outPath,
			);
		});
	})
	.on('error', (e) => {
		console.error('Error fetching index:', e.message);
		process.exit(1);
	});
