import {
	scanEmbeddedRegions,
	regionAtOffset,
	buildVirtualContent,
	type EmbeddedRegion,
} from '../core/embeddedRegions';

/** `text.slice(region.start, region.end)` for the first region. */
const body = (text: string): string => {
	const [r] = scanEmbeddedRegions(text);
	return r ? text.slice(r.start, r.end) : '<none>';
};

describe('scanEmbeddedRegions', () => {
	test('finds a single-line javascript block', () => {
		const t = 'TextQ v;\njavascript="playVideo(\'x.mp4\');";\n';
		const regions = scanEmbeddedRegions(t);
		expect(regions).toHaveLength(1);
		expect(regions[0].language).toBe('javascript');
		expect(regions[0].attribute).toBe('javascript');
		expect(body(t)).toBe("playVideo('x.mp4');");
	});

	test('finds a multi-line block and ends it at the closing quote', () => {
		const t = [
			'q1;',
			'javascript = "',
			'QDot.onSubmit = function(){};',
			'";',
			'export;',
		].join('\n');
		const [r] = scanEmbeddedRegions(t);
		expect(r.language).toBe('javascript');
		expect(text(t, r)).toBe('\nQDot.onSubmit = function(){};\n');
	});

	test('jsHandler is javascript; css is css; casing preserved', () => {
		const regions = scanEmbeddedRegions(
			"jsHandler=\"hideq('a',['b'],['1']);\";\nCSS = \".q{color:red}\";",
		);
		expect(regions.map((r) => [r.attribute, r.language])).toEqual([
			['jsHandler', 'javascript'],
			['CSS', 'css'],
		]);
	});

	test('several regions in one file', () => {
		const t =
			'css="a{}";\n' +
			'text="not js";\n' +
			'javascript="var a=1;";\n' +
			'jshandler="f();";';
		expect(scanEmbeddedRegions(t).map((r) => r.language)).toEqual([
			'css',
			'javascript',
			'javascript',
		]);
	});

	test('an opener inside a line comment or block comment is ignored', () => {
		expect(scanEmbeddedRegions('// javascript="x";\n')).toEqual([]);
		expect(scanEmbeddedRegions('/* css="x"; */\n')).toEqual([]);
	});

	test('an opener inside another string is ignored', () => {
		expect(
			scanEmbeddedRegions('text="see javascript=\\"x\\" in the manual";'),
		).toEqual([]);
	});

	test('escaped quotes inside the block do not end it', () => {
		const t = 'javascript="$(\'#b\').attr(\\"v\\",\\"ok\\");";';
		expect(body(t)).toBe('$(\'#b\').attr(\\"v\\",\\"ok\\");');
	});

	test('a word ending in "javascript" is not an opener', () => {
		expect(scanEmbeddedRegions('myjavascript="x";')).toEqual([]);
		expect(scanEmbeddedRegions('xcss="x";')).toEqual([]);
	});

	test('unterminated block runs to end of text', () => {
		const t = 'javascript="var a = 1;\nvar b = 2;';
		const [r] = scanEmbeddedRegions(t);
		expect(r.end).toBe(t.length);
	});
});

const text = (t: string, r: EmbeddedRegion) => t.slice(r.start, r.end);

describe('regionAtOffset', () => {
	const t = 'q;\njavascript="AB";\n';
	const [r] = scanEmbeddedRegions(t);
	const open = t.indexOf('"') + 1; // offset of 'A'

	test('inside the region (bounds inclusive)', () => {
		expect(regionAtOffset([r], open)).toBe(r);
		expect(regionAtOffset([r], open + 1)).toBe(r);
		expect(regionAtOffset([r], r.end)).toBe(r); // at the closing quote
	});

	test('outside the region', () => {
		expect(regionAtOffset([r], 0)).toBeUndefined();
		expect(regionAtOffset([r], r.end + 1)).toBeUndefined();
	});
});

describe('buildVirtualContent', () => {
	const t = [
		'singleq q1;',
		'text = "hello";',
		'javascript = "',
		"startBackgroundAudioRecording('rec_@insert(_caseid)');",
		'&mymacro;',
		'";',
		'css = ".q{ color: red; }";',
	].join('\n');
	const regions = scanEmbeddedRegions(t);

	test('same length, newlines kept, only the JS region survives for js', () => {
		const v = buildVirtualContent(t, 'javascript', regions);
		expect(v).toHaveLength(t.length);
		expect(v.split('\n')).toHaveLength(t.split('\n').length);
		// the non-JS lines are blank
		expect(v.split('\n')[0]).toBe(' '.repeat('singleq q1;'.length));
		expect(v.split('\n')[6]).toBe(
			' '.repeat('css = ".q{ color: red; }";'.length),
		);
		// the JS body is preserved
		expect(v).toContain('startBackgroundAudioRecording(');
	});

	test('@insert(…) and &macro; are blanked to an equal-length placeholder', () => {
		const v = buildVirtualContent(t, 'javascript', regions);
		expect(v).not.toContain('@insert');
		expect(v).not.toContain('&mymacro;');
		expect(v).toContain("startBackgroundAudioRecording('rec__i_");
		// &mymacro;  -> _i_ + spaces, same length
		const line = v.split('\n')[4];
		expect(line).toBe('_i_' + ' '.repeat('&mymacro;'.length - 3));
	});

	test('css build keeps the css region, blanks the js one', () => {
		const v = buildVirtualContent(t, 'css', regions);
		expect(v).toHaveLength(t.length);
		expect(v).toContain('.q{ color: red; }');
		expect(v).not.toContain('startBackgroundAudioRecording');
	});

	test('append is added on a fresh line and does not shift offsets', () => {
		const v = buildVirtualContent(t, 'javascript', regions, {
			append: 'declare var QDot: any;',
		});
		expect(
			v.startsWith(buildVirtualContent(t, 'javascript', regions)),
		).toBe(true);
		expect(v.endsWith('\ndeclare var QDot: any;')).toBe(true);
	});
});
