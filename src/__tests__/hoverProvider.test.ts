import {
	disambiguateKeyword,
	definitionExcerpt,
} from '../providers/hoverProvider';

describe('disambiguateKeyword', () => {
	test('"single = …" on its own line → the group-attribute key', () => {
		expect(disambiguateKeyword('single', 'single = yes;')).toBe(
			'single-group',
		);
		expect(disambiguateKeyword('single', '   single  =  no ;')).toBe(
			'single-group',
		);
		expect(disambiguateKeyword('Single', 'Single = yes;')).toBe(
			'single-group',
		);
	});

	test('"single" as a label attribute → no override (plain lookup)', () => {
		expect(disambiguateKeyword('single', '1 "eins" single')).toBeUndefined();
		expect(
			disambiguateKeyword('single', 'labels = 1 "x" single'),
		).toBeUndefined();
	});

	test('unrelated words are never overridden', () => {
		expect(disambiguateKeyword('export', 'export = yes;')).toBeUndefined();
	});
});

describe('definitionExcerpt', () => {
	const q = [
		'singleq Frage1;',
		'text = "Wie geht es?";',
		'title = "F1";',
		'labels =',
		'1 "gut"',
		'2 "schlecht"',
		';',
		'flt = vorher eq 1;',
		'assert ( count(Frage1) eq 1 );',
		'initActionBlock = "',
		'  set( x = 1 );',
		'";',
		'javascript = "console.log(1)";',
		'css = "div{color:red}";',
		'',
		'singleq Frage2;',
		'text = "…";',
	];

	test('keeps the definition line and its attributes up to the next question', () => {
		const ex = definitionExcerpt(q, 0);
		expect(ex).toContain('singleq Frage1;');
		expect(ex).toContain('text = "Wie geht es?";');
		expect(ex).toContain('labels =');
		expect(ex).toContain('1 "gut"');
		expect(ex).toContain('flt = vorher eq 1;');
		expect(ex).toContain('assert ( count(Frage1) eq 1 );');
	});

	test('drops actionblock / javascript / css attributes', () => {
		const ex = definitionExcerpt(q, 0);
		expect(ex).not.toMatch(/initActionBlock/i);
		expect(ex).not.toContain('set( x = 1 );');
		expect(ex).not.toMatch(/javascript/i);
		expect(ex).not.toMatch(/console\.log/);
		expect(ex).not.toMatch(/color:red/);
	});

	test('stops at the next definition, not inside it', () => {
		const ex = definitionExcerpt(q, 0);
		expect(ex).not.toContain('Frage2');
	});

	test('a string that contains a keyword line is not treated as a boundary', () => {
		const lines = [
			'openq O1;',
			'text = "',
			'singleq inside the text',
			'still text";',
			'export;',
		];
		const ex = definitionExcerpt(lines, 0);
		expect(ex).toContain('singleq inside the text');
		expect(ex).toContain('export;');
	});

	test('truncates with an ellipsis past maxLines', () => {
		const many = ['compute c = 1;', ...Array(50).fill('add = 1;')];
		const ex = definitionExcerpt(many, 0, 5);
		expect(ex.split('\n')).toHaveLength(6); // 5 lines + "…"
		expect(ex.endsWith('…')).toBe(true);
	});
});
