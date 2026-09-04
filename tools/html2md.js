'use strict';

/**
 * One-off conversion: `dokumentation/online-manual/*.html` (browser-saved
 * copies of the GESS Q. online handbook) -> clean Markdown files in
 * `dokumentation/online-manual/md/`.
 *
 * The saved pages come from "Help & Manual" and share one consistent markup
 * shape (see HISTORY.md if this ever needs a refresher): the real content
 * sits between `<!--ZOOMRESTART-->` / `<!--ZOOMSTOP-->`, built from a small,
 * fixed vocabulary of `p`/`span` classes (`p_Normal`, `p_CodeExample`,
 * `p_GESStabs`, headings, …) plus `a`/`br`/`img`/`table`/`hr`. This script
 * relies on that shape; it is not a general HTML-to-Markdown converter.
 *
 * Run once (or whenever the handbook pages are re-saved):
 *
 *   node tools/html2md.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'dokumentation', 'online-manual');
const OUT_DIR = path.join(SRC_DIR, 'md');

const ENTITIES = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

function decodeEntities(s) {
	return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
		if (code[0] === '#') {
			const n =
				code[1] === 'x' || code[1] === 'X'
					? parseInt(code.slice(2), 16)
					: parseInt(code.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : m;
		}
		const key = code.toLowerCase();
		return Object.prototype.hasOwnProperty.call(ENTITIES, key)
			? ENTITIES[key]
			: m;
	});
}

// ---------------------------------------------------------------------------
// Tiny HTML tree parser (only handles the tag vocabulary this content uses)
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(['br', 'hr', 'img', 'meta', 'link']);

function parseAttrs(rawTag) {
	const attrs = {};
	const re =
		/([a-zA-Z0-9-]+)\s*=\s*"([^"]*)"|([a-zA-Z0-9-]+)\s*=\s*'([^']*)'/g;
	let m;
	while ((m = re.exec(rawTag))) {
		const name = (m[1] || m[3]).toLowerCase();
		attrs[name] = decodeEntities(m[2] !== undefined ? m[2] : m[4]);
	}
	return attrs;
}

function tokenize(html) {
	const tokens = [];
	let i = 0;
	while (i < html.length) {
		if (html[i] === '<') {
			const close = html.indexOf('>', i);
			if (close < 0) {
				break;
			}
			const raw = html.slice(i, close + 1);
			const nameMatch = raw.match(/^<\/?([a-zA-Z0-9]+)/);
			if (!nameMatch) {
				// stray "<" (e.g. from a comparison in leftover text) - treat as text
				tokens.push({ type: 'text', value: '<' });
				i++;
				continue;
			}
			const name = nameMatch[1].toLowerCase();
			const isClose = raw[1] === '/';
			if (isClose) {
				tokens.push({ type: 'close', name });
			} else {
				const selfClose = /\/>\s*$/.test(raw) || VOID_TAGS.has(name);
				tokens.push({
					type: selfClose ? 'void' : 'open',
					name,
					attrs: parseAttrs(raw),
				});
			}
			i = close + 1;
		} else {
			const next = html.indexOf('<', i);
			const text = next === -1 ? html.slice(i) : html.slice(i, next);
			if (text) {
				tokens.push({ type: 'text', value: text });
			}
			i = next === -1 ? html.length : next;
		}
	}
	return tokens;
}

function buildTree(tokens) {
	const root = { type: 'root', name: 'root', attrs: {}, children: [] };
	const stack = [root];
	for (const t of tokens) {
		const top = stack[stack.length - 1];
		if (t.type === 'text') {
			top.children.push({ type: 'text', value: t.value });
		} else if (t.type === 'void') {
			top.children.push({
				type: 'tag',
				name: t.name,
				attrs: t.attrs,
				children: [],
			});
		} else if (t.type === 'open') {
			const node = {
				type: 'tag',
				name: t.name,
				attrs: t.attrs,
				children: [],
			};
			top.children.push(node);
			stack.push(node);
		} else if (t.type === 'close') {
			for (let k = stack.length - 1; k > 0; k--) {
				if (stack[k].name === t.name) {
					stack.length = k;
					break;
				}
			}
		}
	}
	return root;
}

function parseHtml(html) {
	return buildTree(tokenize(html));
}

// ---------------------------------------------------------------------------
// Rendering: inline "text" mode (produces Markdown) and "code" mode (raw text)
// ---------------------------------------------------------------------------

const CODE_SPAN_CLASSES = new Set([
	'f_CodeinFliesstext2',
	'f_CodeinFliesstext',
	'f_T_Code',
	'f_CodeExample',
]);

function isBold(attrs) {
	return !!attrs.style && /font-weight\s*:\s*bold/i.test(attrs.style);
}

/** Pull `<a id="...">` anchor placeholders out of an inline-code span so they
 * sit outside the backtick run instead of corrupting it. */
function wrapInlineCode(md) {
	const anchors = [];
	const cleaned = md.replace(/<a id="[^"]*"[^>]*><\/a>/g, (m) => {
		anchors.push(m);
		return '';
	});
	const trimmed = cleaned.trim();
	return trimmed ? anchors.join('') + '`' + trimmed + '`' : anchors.join('');
}

function escapeMd(text) {
	// Only escape characters that would otherwise be misread as Markdown
	// syntax in running prose; code spans/blocks go through renderCode()
	// instead and skip this entirely.
	return text.replace(/([\\`*_[\]])/g, '\\$1');
}

function renderChildrenText(node, ctx) {
	return node.children.map((c) => renderText(c, ctx)).join('');
}

function renderText(node, ctx) {
	if (node.type === 'text') {
		// Newlines here are markup pretty-printing, not meaningful whitespace
		// (real line breaks come from <br>) - collapse like a browser would.
		return escapeMd(decodeEntities(node.value).replace(/\r?\n/g, ' '));
	}
	if (node.type === 'root') {
		return renderChildrenText(node, ctx);
	}
	switch (node.name) {
		case 'br':
			return '\n';
		case 'a': {
			if (node.attrs.href) {
				const label = renderChildrenText(node, ctx) || node.attrs.href;
				return `[${label}](${mdDest(resolveHref(node.attrs.href, ctx))})`;
			}
			if (node.attrs.id) {
				return `<a id="${node.attrs.id}"></a>`;
			}
			return renderChildrenText(node, ctx);
		}
		case 'img': {
			const alt = node.attrs.alt || node.attrs.title || '';
			const src = resolveImgSrc(node.attrs.src, ctx);
			return src ? `![${alt}](${mdDest(src)})` : '';
		}
		case 'span': {
			const cls = (node.attrs.class || '').trim();
			if (CODE_SPAN_CLASSES.has(cls)) {
				// Raw text, not the Markdown-escaped inline rendering - content
				// inside backticks must not carry backslash escapes.
				return wrapInlineCode(renderChildrenCode(node));
			}
			const inner = renderChildrenText(node, ctx);
			if (isBold(node.attrs)) {
				const t = inner.trim();
				return t ? `**${t}**` : inner;
			}
			return inner;
		}
		default:
			return renderChildrenText(node, ctx);
	}
}

function renderChildrenCode(node) {
	return node.children.map((c) => renderCode(c)).join('');
}

function renderCode(node) {
	if (node.type === 'text') {
		// Same markup-only newlines as renderText(), but code lines are
		// reconstructed purely from <br>, so drop them instead of collapsing
		// to a space.
		return decodeEntities(node.value).replace(/\r?\n/g, '');
	}
	if (node.type === 'root') {
		return renderChildrenCode(node);
	}
	switch (node.name) {
		case 'br':
			return '\n';
		case 'a':
			return renderChildrenCode(node);
		default:
			return renderChildrenCode(node);
	}
}

// ---------------------------------------------------------------------------
// Link / image resolution
// ---------------------------------------------------------------------------

/**
 * CommonMark link destinations without `<...>` end at the first space or
 * unbalanced `)` - several of the generated filenames (kept parallel to the
 * saved HTML names, e.g. "…-(select).md") contain exactly that, so wrap
 * whenever a plain destination would be ambiguous.
 */
function mdDest(dest) {
	return /[\s()]/.test(dest) ? `<${dest}>` : dest;
}

function resolveHref(href, ctx) {
	const trimmed = (href || '').trim();
	if (!trimmed || /^(mailto:|tel:|javascript:)/i.test(trimmed)) {
		return trimmed;
	}
	const [pathPart, frag] = trimmed.split('#');
	const base = (pathPart.split('/').pop() || '').toLowerCase();
	const target = base && ctx.urlMap.get(base);
	if (target) {
		return `./${target.mdFile}${frag ? '#' + frag : ''}`;
	}
	return trimmed;
}

function resolveImgSrc(src, ctx) {
	if (!src) {
		return '';
	}
	if (/^https?:/i.test(src)) {
		return src;
	}
	// Assets live one level up from OUT_DIR (dokumentation/online-manual/md/),
	// in dokumentation/online-manual/ itself - same relative path the saved
	// HTML page used, since OUT_DIR is now that page's sibling.
	const rel = src.replace(/^\.\//, '');
	return `../${rel}`;
}

// ---------------------------------------------------------------------------
// Block-level conversion
// ---------------------------------------------------------------------------

const HEADING_CLASS = {
	p_Heading1: '#',
	p_UeberschriftinKapitel: '##',
	p_UnterueberschriftinKapitel: '###',
	p_UnterunterueberschriftinKapitel: '####',
};

function cellToMd(td, ctx) {
	const paras = td.children.filter((c) => c.type === 'tag' && c.name === 'p');
	const parts = (paras.length ? paras : [td]).map((p) =>
		renderChildrenText(p, ctx).trim().replace(/\n+/g, ' '),
	);
	return parts.filter(Boolean).join('<br>') || '&nbsp;';
}

function tableToMd(node, ctx) {
	const rows = [];
	const walk = (n) => {
		for (const c of n.children) {
			if (c.type !== 'tag') {
				continue;
			}
			if (c.name === 'tr') {
				rows.push(
					c.children
						.filter((cc) => cc.type === 'tag' && cc.name === 'td')
						.map((td) => cellToMd(td, ctx)),
				);
			} else {
				walk(c);
			}
		}
	};
	walk(node);
	if (rows.length === 0) {
		return '';
	}
	const cols = Math.max(...rows.map((r) => r.length));
	const pad = (r) => {
		const cells = r.slice();
		while (cells.length < cols) {
			cells.push('');
		}
		return cells;
	};
	const lines = [];
	lines.push('| ' + pad(rows[0]).join(' | ') + ' |');
	lines.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
	for (const r of rows.slice(1)) {
		lines.push('| ' + pad(r).join(' | ') + ' |');
	}
	return lines.join('\n');
}

/** Split a p_GESStabs paragraph into its `<br>`-separated code lines. */
function gesstabsLines(node) {
	const text = renderCode(node);
	// A "&nbsp;"-only line is a deliberate blank spacer - render it as an
	// actually empty line rather than one stray space character.
	return text.split('\n').map((line) => (line.trim() === '' ? '' : line));
}

/**
 * `<div>` wrappers around a `<table>` (or other block content) carry no
 * semantics here - inline their children in place, recursively, so the
 * block scan below always sees `p`/`table`/`hr` at the top level.
 */
function flattenDivs(children) {
	const out = [];
	for (const c of children) {
		if (c.type === 'tag' && c.name === 'div') {
			out.push(...flattenDivs(c.children));
		} else {
			out.push(c);
		}
	}
	return out;
}

function convertContent(rootNode, ctx) {
	const out = [];
	let codeBuf = null; // accumulates consecutive p_GESStabs paragraphs

	const flushCode = () => {
		if (codeBuf) {
			out.push(
				'```\n' + codeBuf.join('\n').replace(/\s+$/, '') + '\n```',
			);
			codeBuf = null;
		}
	};

	for (const node of flattenDivs(rootNode.children)) {
		if (node.type !== 'tag') {
			continue;
		}
		if (node.name === 'hr') {
			flushCode();
			out.push('---');
			continue;
		}
		if (node.name === 'table') {
			flushCode();
			const md = tableToMd(node, ctx);
			if (md) {
				out.push(md);
			}
			continue;
		}
		if (node.name !== 'p') {
			// Unexpected top-level element (shouldn't happen for this source) -
			// render its text so nothing silently disappears.
			flushCode();
			const md = renderChildrenText(node, ctx).trim();
			if (md) {
				out.push(md);
			}
			continue;
		}

		const cls = (node.attrs.class || '').trim();

		if (cls === 'p_GESStabs') {
			codeBuf = codeBuf || [];
			codeBuf.push(...gesstabsLines(node));
			continue;
		}
		flushCode();

		if (cls === 'p_CodeExample' || cls === 'p_CodeinFliesstext') {
			const code = renderCode(node).trim();
			if (code) {
				out.push('```\n' + code + '\n```');
			}
			continue;
		}

		const heading = HEADING_CLASS[cls];
		if (heading) {
			// A stray "<br>&nbsp;<br>more text" sometimes tacks trailing prose
			// onto the heading paragraph itself - only the first line is the
			// actual heading, the rest becomes its own paragraph(s).
			const lines = renderChildrenText(node, ctx)
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length > 0) {
				out.push(`${heading} ${lines[0]}`);
				for (const extra of lines.slice(1)) {
					out.push(extra);
				}
			}
			continue;
		}

		const text = renderChildrenText(node, ctx).trim();
		if (!text) {
			continue;
		}
		if (cls === 'p_NormalAufzaehlung') {
			// The source already spells out a bullet glyph in the text; drop it
			// since the Markdown list marker replaces it.
			out.push(`- ${text.replace(/^[•*-]\s*/, '')}`);
		} else if (cls === 'p_Fussnote') {
			out.push(`> ${text}`);
		} else {
			out.push(text);
		}
	}
	flushCode();
	return out.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// File-level driver
// ---------------------------------------------------------------------------

function readSource(file) {
	return fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
}

function sourceUrlOf(html) {
	const m = html.match(/saved from url=\([^)]*\)([^\s>]+)/);
	return m ? m[1] : null;
}

function titleOf(html) {
	const m = html.match(/<title>([\s\S]*?)<\/title>/i);
	return m ? decodeEntities(m[1]).trim() : '';
}

function contentOf(html) {
	const m = html.match(/<!--ZOOMRESTART-->([\s\S]*?)<!--ZOOMSTOP-->/);
	return m ? m[1] : '';
}

function main() {
	const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.html'));

	const urlMap = new Map(); // basename -> { file, mdFile, title }
	const pages = [];
	for (const file of files) {
		const html = readSource(file);
		const url = sourceUrlOf(html);
		if (!url) {
			console.warn(`skip (no source url comment): ${file}`);
			continue;
		}
		const base = url.split('/').pop();
		const mdFile = base.replace(/\.html$/i, '.md');
		const title = titleOf(html);
		urlMap.set(base.toLowerCase(), { file, mdFile, title });
		pages.push({ file, url, base, mdFile, title });
	}

	fs.mkdirSync(OUT_DIR, { recursive: true });

	for (const page of pages) {
		const html = readSource(page.file);
		const content = contentOf(html);
		if (!content) {
			console.warn(`skip (no ZOOMRESTART/STOP content): ${page.file}`);
			continue;
		}
		const stripped = content.replace(/<!--[\s\S]*?-->/g, '');
		const tree = parseHtml(stripped);
		const ctx = { urlMap };
		const body = convertContent(tree, ctx);

		// titleOf() already decoded entities, so the breadcrumb separator here
		// is a plain ">" - swap it for a nicer arrow.
		const heading = page.title.replace(/\s*>\s*/g, ' › ');
		const md =
			`# ${heading}\n\n` + `Quelle: <${page.url}>\n\n` + '---\n\n' + body;

		fs.writeFileSync(path.join(OUT_DIR, page.mdFile), md, 'utf8');
	}

	const index =
		'# GESS Q. Online-Handbuch\n\n' +
		'Aus `dokumentation/online-manual/` generierte Markdown-Fassung (siehe\n' +
		'`tools/html2md.js`). Bilder verlinken zurück in die gespeicherten\n' +
		'Original-Seiten.\n\n' +
		pages
			.slice()
			.sort((a, b) => a.base.localeCompare(b.base))
			.map(
				(p) =>
					`- [${(p.title || p.mdFile).replace(/\s*>\s*/g, ' › ')}](${mdDest('./' + p.mdFile)})`,
			)
			.join('\n') +
		'\n';
	fs.writeFileSync(path.join(OUT_DIR, 'README.md'), index, 'utf8');

	console.log(`Converted ${pages.length} pages to ${OUT_DIR}`);
}

main();
