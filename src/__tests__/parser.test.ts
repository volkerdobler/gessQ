import {
	questionDefRe,
	definitionDefRe,
	blockDefRe,
	blockRe,
	macroDefRe,
	actionBlockDefRe,
	arrayDefRe,
	quotavarDefRe,
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
	test('matches "#macro NAME" at the start of a line (name, no #)', () => {
		const m = '#macro labellist'.match(macroDefRe(''));
		expect(m).not.toBeNull();
		expect(m![1].toLowerCase()).toBe('macro');
		expect(m![2]).toBe('labellist');
	});

	test('matches "  #macro NAME" with leading whitespace', () => {
		expect('\t#macro auto_schablone'.match(macroDefRe(''))).not.toBeNull();
	});

	test('does not match "x#macro"', () => {
		expect('x#macro foo'.match(macroDefRe(''))).toBeNull();
	});

	test('named variant is specific', () => {
		expect('#macro foo'.match(macroDefRe('foo'))).not.toBeNull();
		expect('#macro bar'.match(macroDefRe('foo'))).toBeNull();
	});
});

describe('actionBlockDefRe', () => {
	test('matches "load( NAME =" and "set( NAME ="', () => {
		expect(
			'load( qTarget = 1 )'.match(actionBlockDefRe('')),
		).not.toBeNull();
		expect('set(qTarget=1)'.match(actionBlockDefRe(''))).not.toBeNull();
	});

	test('does not match a bare "load" without parenthesised assignment', () => {
		expect('loaded = 1'.match(actionBlockDefRe(''))).toBeNull();
	});
});

describe('arrayDefRe', () => {
	test('matches "array NAME [SIZE];" and captures keyword + name', () => {
		const m = 'array group [3];'.match(arrayDefRe(''));
		expect(m).not.toBeNull();
		expect(m![1].toLowerCase()).toBe('array');
		expect(m![2]).toBe('group');
	});

	test('matches "array NAME = [ … ];"', () => {
		const m = 'array werte = [ 0*10 ];'.match(arrayDefRe(''));
		expect(m).not.toBeNull();
		expect(m![2]).toBe('werte');
	});

	test('matches "vararray NAME = ( … );"', () => {
		const m = 'vararray group = ( v1 v2 v3 );'.match(arrayDefRe(''));
		expect(m).not.toBeNull();
		expect(m![1].toLowerCase()).toBe('vararray');
		expect(m![2]).toBe('group');
	});

	test('is case-insensitive and tolerates missing spaces', () => {
		expect('ARRAY x=[1 2 3];'.match(arrayDefRe(''))).not.toBeNull();
	});

	test('named variant only matches that name', () => {
		expect('array group [3];'.match(arrayDefRe('group'))).not.toBeNull();
		expect('array other [3];'.match(arrayDefRe('group'))).toBeNull();
	});

	test('does not match the "arrayinitmode" parameter', () => {
		expect('arrayinitmode = 1;'.match(arrayDefRe(''))).toBeNull();
	});
});

describe('quotavarDefRe', () => {
	test('matches "quotavar NAME = ( … );" and captures keyword + name', () => {
		const m = 'quotavar qAge = ( age ge 18 );'.match(quotavarDefRe(''));
		expect(m).not.toBeNull();
		expect(m![1].toLowerCase()).toBe('quotavar');
		expect(m![2]).toBe('qAge');
	});

	test('is case-insensitive', () => {
		expect('QUOTAVAR X = (1);'.match(quotavarDefRe(''))).not.toBeNull();
	});

	test('named variant only matches that name', () => {
		expect(
			'quotavar qAge = (1)'.match(quotavarDefRe('qAge')),
		).not.toBeNull();
		expect('quotavar qSex = (1)'.match(quotavarDefRe('qAge'))).toBeNull();
	});

	test('does not match the "prequotavar" parameter', () => {
		expect('prequotavar foo = (1);'.match(quotavarDefRe(''))).toBeNull();
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
