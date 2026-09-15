import { renderReleaseNotesMarkdown } from '../infra/releaseNotesMarkdown';

describe('renderReleaseNotesMarkdown', () => {
	test('renders a heading with a slugified id', () => {
		expect(renderReleaseNotesMarkdown('# Title')).toBe(
			'<h1 id="title">Title</h1>',
		);
		expect(renderReleaseNotesMarkdown('## Sub')).toBe(
			'<h2 id="sub">Sub</h2>',
		);
		expect(renderReleaseNotesMarkdown('### SubSub')).toBe(
			'<h3 id="subsub">SubSub</h3>',
		);
	});

	test("slugifies a heading's non-alphanumeric characters into hyphens", () => {
		expect(
			renderReleaseNotesMarkdown("## What's New in Version 1.0.0"),
		).toBe('<h2 id="what-s-new-in-version-1-0-0">What\'s New in Version 1.0.0</h2>');
	});

	test('disambiguates two headings that slugify to the same id', () => {
		const md = '## Notes\n\n## Notes';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<h2 id="notes">Notes</h2>\n<h2 id="notes-2">Notes</h2>',
		);
	});

	test('renders a bullet list, grouping consecutive bullets into one <ul>', () => {
		const md = '- one\n- two\n- three';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<ul><li>one</li><li>two</li><li>three</li></ul>',
		);
	});

	test('accepts "*" as a bullet marker too', () => {
		expect(renderReleaseNotesMarkdown('* only')).toBe(
			'<ul><li>only</li></ul>',
		);
	});

	test('reflows a multi-line paragraph onto one <p>', () => {
		const md = 'line one\nline two';
		expect(renderReleaseNotesMarkdown(md)).toBe('<p>line one line two</p>');
	});

	test('separates blocks on blank lines', () => {
		const md = '# Title\n\npara one\n\n- a\n- b\n\npara two';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<h1 id="title">Title</h1>\n<p>para one</p>\n<ul><li>a</li><li>b</li></ul>\n<p>para two</p>',
		);
	});

	test('renders inline **bold**, `code`, and [links](url)', () => {
		const md =
			'a **bold** word, some `code`, and a [link](https://example.com)';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<p>a <strong>bold</strong> word, some <code>code</code>, and a <a href="https://example.com">link</a></p>',
		);
	});

	test('does not let a lone "*" inside one code span pair up with one inside another', () => {
		const md = 'patterns: `main*.tab`, `*.tab`';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<p>patterns: <code>main*.tab</code>, <code>*.tab</code></p>',
		);
	});

	test('renders inline *italic*, distinct from **bold**', () => {
		expect(renderReleaseNotesMarkdown('an *italic* word')).toBe(
			'<p>an <em>italic</em> word</p>',
		);
		expect(renderReleaseNotesMarkdown('**bold** and *italic*')).toBe(
			'<p><strong>bold</strong> and <em>italic</em></p>',
		);
	});

	test('escapes raw HTML-significant characters before applying inline markup', () => {
		const md = 'IF v1 IS MULTIQ THEN a<b & c>d';
		expect(renderReleaseNotesMarkdown(md)).toBe(
			'<p>IF v1 IS MULTIQ THEN a&lt;b &amp; c&gt;d</p>',
		);
	});

	test('escapes HTML inside a heading and a list item too', () => {
		expect(renderReleaseNotesMarkdown('# a < b')).toBe(
			'<h1 id="a-b">a &lt; b</h1>',
		);
		expect(renderReleaseNotesMarkdown('- a < b')).toBe(
			'<ul><li>a &lt; b</li></ul>',
		);
	});

	test('ignores blank lines between paragraphs and lists entirely', () => {
		expect(renderReleaseNotesMarkdown('\n\npara\n\n\n')).toBe('<p>para</p>');
	});

	test('returns an empty string for empty input', () => {
		expect(renderReleaseNotesMarkdown('')).toBe('');
	});
});
