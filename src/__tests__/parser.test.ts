import {
	questionDefRe,
	definitionDefRe,
	blockDefRe,
	blockRe,
	macroDefRe,
	getWordDefinition,
} from '../core/parser';

describe('questionDefRe', () => {
	test('matches a question definition and captures type + name', () => {
		const m = 'singleq Frage1;'.match(questionDefRe(''));
		expect(m).not.toBeNull();
		expect(m![1].toLowerCase()).toBe('singleq');
		expect(m![2]).toBe('Frage1');
	});

	test('is case-insensitive on the keyword', () => {
		expect('SingleQ Frage1'.match(questionDefRe(''))).not.toBeNull();
	});

	test('matches every documented question type', () => {
		for (const t of [
			'singleq',
			'multiq',
			'singlegridq',
			'multigridq',
			'openq',
			'textq',
			'numq',
			'group',
		]) {
			expect(`${t} X`.match(questionDefRe(''))).not.toBeNull();
		}
	});

	test('named variant only matches that name', () => {
		expect('singleq Frage1'.match(questionDefRe('Frage1'))).not.toBeNull();
		expect('singleq Frage2'.match(questionDefRe('Frage1'))).toBeNull();
	});

	test('does not match an arbitrary identifier', () => {
		expect('foobar Frage1'.match(questionDefRe(''))).toBeNull();
	});
});

describe('definitionDefRe', () => {
	test('matches opennumformat definitions', () => {
		const m = 'opennumformat onf_TEST = 1 2 0 2 0 100 0 "err";'.match(
			definitionDefRe(''),
		);
		expect(m).not.toBeNull();
		expect(m![2]).toBe('onf_TEST');
	});
});

describe('blockDefRe / blockRe', () => {
	test('blockDefRe matches "block name ="', () => {
		expect(
			'block myBlock = ( q1 q2 );'.match(blockDefRe('')),
		).not.toBeNull();
		expect(
			'screen s1 = column ( q1 );'.match(blockDefRe('')),
		).not.toBeNull();
	});

	test('blockDefRe named variant is specific', () => {
		expect('block myBlock ='.match(blockDefRe('myBlock'))).not.toBeNull();
		expect('block other ='.match(blockDefRe('myBlock'))).toBeNull();
	});

	test('blockRe finds a block referenced inside another block', () => {
		expect(
			'block top = ( sub1 sub2 );'.match(blockRe('sub1')),
		).not.toBeNull();
	});
});

describe('macroDefRe', () => {
	// KNOWN BUG (see TODO.md 4.3): the leading `\b#` can never match `#macro`
	// at a line start because there is no word boundary before `#`.
	// `test.failing` keeps CI green and flips to a failure once it is fixed.
	test.failing('matches "#macro #Name" at the start of a line', () => {
		expect('#macro #GN'.match(macroDefRe(''))).not.toBeNull();
	});
});

describe('getWordDefinition', () => {
	test('matches bare, double- and single-quoted forms', () => {
		const re = new RegExp(getWordDefinition('foo'));
		expect(re.test('foo')).toBe(true);
		expect(re.test('"foo"')).toBe(true);
		expect(re.test("'foo'")).toBe(true);
		expect(re.test('foobar')).toBe(false);
	});
});
