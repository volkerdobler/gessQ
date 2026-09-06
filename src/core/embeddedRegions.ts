'use strict';

/**
 * Scanner for the embedded JavaScript / CSS regions of a GESS Q. document – the
 * string literal of a `javascript = "…"`, `jsHandler = "…"` or `css = "…"`
 * attribute – plus the transform that turns a `.q` document into the virtual
 * `.ts` / `.css` document forwarded to the built-in language services (see
 * {@link ../providers/embeddedLanguage}).
 *
 * Pure string helpers, no `vscode` dependency, so the virtual-document plumbing
 * stays unit testable.
 */

export type EmbeddedLanguage = 'javascript' | 'css';

export interface EmbeddedRegion {
	language: EmbeddedLanguage;
	/** The attribute keyword as written (`javascript` / `jsHandler` / `css`). */
	attribute: string;
	/** Offset of the first character inside the string (just after the `"`). */
	start: number;
	/**
	 * Offset just past the last content character – at the closing `"`, or at
	 * end-of-text for an unterminated block.
	 */
	end: number;
}

/** Attribute keyword immediately before an opening `"`, mapped to its language. */
const ATTR_LANGUAGE: Record<string, EmbeddedLanguage> = {
	javascript: 'javascript',
	jshandler: 'javascript',
	css: 'css',
};

const ATTR_OPENER = /(?:^|[^A-Za-z0-9_])(javascript|jshandler|css)\s*=\s*$/i;

/**
 * All embedded JS / CSS regions in `text`, in source order. Openers inside
 * comments or other strings are ignored; a block that is never closed runs to
 * the end of the text.
 */
export function scanEmbeddedRegions(text: string): EmbeddedRegion[] {
	const regions: EmbeddedRegion[] = [];
	const n = text.length;
	// 0 = normal, 1 = line comment, 2 = block comment
	let state = 0;
	let i = 0;

	while (i < n) {
		const c = text[i];

		if (state === 1) {
			if (c === '\n') {
				state = 0;
			}
			i++;
			continue;
		}
		if (state === 2) {
			if (c === '*' && text[i + 1] === '/') {
				state = 0;
				i += 2;
			} else {
				i++;
			}
			continue;
		}

		if (c === '/' && text[i + 1] === '/') {
			state = 1;
			i += 2;
			continue;
		}
		if (c === '/' && text[i + 1] === '*') {
			state = 2;
			i += 2;
			continue;
		}
		if (c === "'") {
			i = skipString(text, i, "'");
			continue;
		}
		if (c === '"') {
			const attr = attributeBefore(text, i);
			if (attr) {
				const start = i + 1;
				const end = findStringEnd(text, start, '"');
				regions.push({
					language: ATTR_LANGUAGE[attr.toLowerCase()],
					attribute: attr,
					start,
					end,
				});
				i = end < n ? end + 1 : n;
				continue;
			}
			i = skipString(text, i, '"');
			continue;
		}
		i++;
	}

	return regions;
}

/** The region containing `offset` (its `"` bounds are inclusive), or none. */
export function regionAtOffset(
	regions: readonly EmbeddedRegion[],
	offset: number,
): EmbeddedRegion | undefined {
	return regions.find((r) => offset >= r.start && offset <= r.end);
}

/** `javascript` / `jshandler` / `css` written right before `text[quoteIdx]`. */
function attributeBefore(text: string, quoteIdx: number): string | undefined {
	const head = text.slice(Math.max(0, quoteIdx - 64), quoteIdx);
	const m = ATTR_OPENER.exec(head);
	return m ? m[1] : undefined;
}

/** Index just past the string opened at `openIdx` (`\` escapes the next char). */
function skipString(text: string, openIdx: number, delim: string): number {
	const end = findStringEnd(text, openIdx + 1, delim);
	return end < text.length ? end + 1 : text.length;
}

/** Index of the unescaped closing `delim` at/after `from`, or `text.length`. */
function findStringEnd(text: string, from: number, delim: string): number {
	let i = from;
	while (i < text.length) {
		const c = text[i];
		if (c === '\\') {
			i += 2;
			continue;
		}
		if (c === delim) {
			return i;
		}
		i++;
	}
	return text.length;
}

/**
 * `@insert(…)` / `@insert[…]` / `@insert{…}` and `&macroName;` – GESS Q.
 * preprocessor constructs that are not JS / CSS. Blanked to an equal-length
 * placeholder so positions stay 1:1 and the JS / CSS parser sees a token.
 */
const HIDE_PATTERNS: readonly RegExp[] = [
	/@insert\s*\([^)\r\n]*\)/gi,
	/@insert\s*\[[^\]\r\n]*\]/gi,
	/@insert\s*\{[^}\r\n]*\}/gi,
	/&[A-Za-z_]\w*;/g,
];

const PLACEHOLDER = '_i_';

export interface BuildOptions {
	/** Text appended after the blanked body (e.g. the ambient globals). */
	append?: string;
}

/**
 * Build the virtual document for `language`: every character outside a region
 * of that language becomes a space (newlines kept, so offsets and line numbers
 * map 1:1); inside a region `@insert(…)` / `&macro;` are blanked the same way.
 * `opts.append` is added on fresh lines at the end – outside every region, so
 * it shifts nothing.
 */
export function buildVirtualContent(
	text: string,
	language: EmbeddedLanguage,
	regions: readonly EmbeddedRegion[],
	opts: BuildOptions = {},
): string {
	const out = new Array<string>(text.length);
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		out[i] = c === '\n' || c === '\r' ? c : ' ';
	}

	for (const r of regions) {
		if (r.language !== language) {
			continue;
		}
		const end = Math.min(r.end, text.length);
		for (let i = r.start; i < end; i++) {
			out[i] = text[i];
		}
		blankHidden(out, text, r.start, end);
	}

	const body = out.join('');
	return opts.append ? body + '\n' + opts.append : body;
}

function blankHidden(
	out: string[],
	text: string,
	start: number,
	end: number,
): void {
	const slice = text.slice(start, end);
	for (const re of HIDE_PATTERNS) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(slice))) {
			const at = start + m.index;
			for (let k = 0; k < m[0].length; k++) {
				const ch = text[at + k];
				if (ch === '\n' || ch === '\r') {
					continue;
				}
				out[at + k] =
					k < PLACEHOLDER.length && m[0].length >= PLACEHOLDER.length
						? PLACEHOLDER[k]
						: ' ';
			}
		}
	}
}
