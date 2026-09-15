'use strict';

// A deliberately small Markdown-to-HTML renderer for the release-notes
// webview (see releaseNotes.ts) – not a general CommonMark engine, just the
// handful of constructs a release-notes file actually uses: headings,
// bullet lists, paragraphs, and inline **bold**/*italic*/`code`/[links](url).
// Kept in its own pure module (no vscode import) so it's unit-testable like
// the rest of this codebase's parsers.
//
// Every raw text run is HTML-escaped before any markup is applied, so
// literal `<`/`>`/`&` in release notes (e.g. "IF v1 IS MULTIQ THEN") can
// never be misread as real tags, and the inline patterns below only ever
// introduce tags this module itself controls.

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// U+E000 is in the Private Use Area – guaranteed not to occur in real
// Markdown source (and not a control character, so it can't trip an editor
// or linter that scans for those) – marks where a code span was pulled out
// of the text below.
const PLACEHOLDER = String.fromCharCode(0xe000);
const placeholderRe = new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g');

// Applied to already-escaped text, so the only "<"/">" characters present
// are the ones these patterns introduce themselves. Code spans are pulled
// out and replaced with a placeholder *first*, before bold/italic/links
// ever see the text – a code span's content (a glob like `main*.tab`, a
// lone `*`/`_`/`[`) must never be reinterpreted as markup, and worse, an
// unpaired "*" inside one code span could otherwise pair up with one inside
// a *different* code span later on the same line and wrap everything in
// between (backticks included) in a bogus <em>.
function renderInline(escaped: string): string {
	const codeSpans: string[] = [];
	const withPlaceholders = escaped.replace(/`([^`]+)`/g, (_m, code) => {
		codeSpans.push(`<code>${code}</code>`);
		return `${PLACEHOLDER}${codeSpans.length - 1}${PLACEHOLDER}`;
	});

	const withMarkup = withPlaceholders
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>');

	return withMarkup.replace(placeholderRe, (_m, idx) => codeSpans[Number(idx)]);
}

function renderInlineText(raw: string): string {
	return renderInline(escapeHtml(raw));
}

// A heading's id, for an in-page `[jump to it](#id)` link – collapse
// anything that isn't a letter/digit into a single "-", so "What's New in
// Version 1.0.0" becomes "what-s-new-in-version-1-0-0". Not an attempt to
// match GitHub's own slugger (nothing here is ever rendered by GitHub); it
// only has to agree with itself.
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const headingRe = /^(#{1,3})\s+(.*)$/;
const bulletRe = /^[-*]\s+(.*)$/;

export function renderReleaseNotesMarkdown(markdown: string): string {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const html: string[] = [];
	const seenSlugs = new Map<string, number>();
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.trim().length === 0) {
			i += 1;
			continue;
		}

		const heading = line.match(headingRe);
		if (heading) {
			const level = heading[1].length;
			const base = slugify(heading[2]);
			const seenCount = seenSlugs.get(base) ?? 0;
			seenSlugs.set(base, seenCount + 1);
			const id = seenCount === 0 ? base : `${base}-${seenCount + 1}`;
			html.push(
				`<h${level} id="${id}">${renderInlineText(heading[2])}</h${level}>`,
			);
			i += 1;
			continue;
		}

		if (bulletRe.test(line)) {
			const items: string[] = [];
			while (i < lines.length && bulletRe.test(lines[i])) {
				const m = lines[i].match(bulletRe) as RegExpMatchArray;
				items.push(`<li>${renderInlineText(m[1])}</li>`);
				i += 1;
			}
			html.push(`<ul>${items.join('')}</ul>`);
			continue;
		}

		// Paragraph: a run of non-blank, non-heading, non-bullet lines,
		// reflowed onto one line the way a Markdown viewer would.
		const paragraph: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim().length > 0 &&
			!headingRe.test(lines[i]) &&
			!bulletRe.test(lines[i])
		) {
			paragraph.push(lines[i]);
			i += 1;
		}
		html.push(`<p>${renderInlineText(paragraph.join(' '))}</p>`);
	}

	return html.join('\n');
}
