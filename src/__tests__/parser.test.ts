import {
	questionDefRe,
	definitionDefRe,
	blockDefRe,
	blockRe,
	checkRe,
	macroDefRe,
	actionBlockDefRe,
	arrayDefRe,
	quotavarDefRe,
	getWordDefinition,
	getWordDefinitionStrict,
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

	test('treats regex metacharacters in a valid-looking name literally', () => {
		// not a valid name -> never matches, and never throws
		expect(() => new RegExp(getWordDefinition('on.f'))).not.toThrow();
		expect(new RegExp(getWordDefinition('on.f')).test('onXf')).toBe(false);
	});

	test('accepts a leading underscore (built-in system variables)', () => {
		const re = new RegExp(getWordDefinition('_finished'));
		expect(re.test('_finished')).toBe(true);
		expect(re.test('"_finished"')).toBe(true);
		expect(re.test('_finishdate')).toBe(false);
	});

	test('rejects names outside the grammar (umlaut, $, leading digit, dot, space)', () => {
		for (const bad of [
			'Fräge',
			'$foo',
			'1foo',
			'a.b',
			'a b',
			'',
			'a+b',
			'a)b',
		]) {
			const re = new RegExp(getWordDefinition(bad));
			expect(re.test(bad)).toBe(false);
			expect(re.test(`"${bad}"`)).toBe(false);
		}
	});

	test('an invalid name makes a wrapping factory never match', () => {
		expect('singleq Fräge'.match(questionDefRe('Fräge'))).toBeNull();
		expect('block Fräge ='.match(blockDefRe('Fräge'))).toBeNull();
	});
});

describe('getWordDefinitionStrict', () => {
	test('rejects a leading underscore (built-in vars cannot be defined)', () => {
		const re = new RegExp(getWordDefinitionStrict('_finished'));
		expect(re.test('_finished')).toBe(false);
		expect(re.test('"_finished"')).toBe(false);
	});

	test('still matches an ordinary name', () => {
		const re = new RegExp(getWordDefinitionStrict('Frage1'));
		expect(re.test('Frage1')).toBe(true);
		expect(re.test('"Frage1"')).toBe(true);
	});
});

describe('definition vs. reference: leading underscore', () => {
	test('definition factories do not accept a "_name" as a definition', () => {
		expect('singleq _finished;'.match(questionDefRe('_finished'))).toBeNull();
		expect('singleq _finished;'.match(questionDefRe(''))).toBeNull();
		expect('array _x [3];'.match(arrayDefRe('_x'))).toBeNull();
		expect('quotavar _q = (1);'.match(quotavarDefRe('_q'))).toBeNull();
		expect('block _b ='.match(blockDefRe('_b'))).toBeNull();
		expect('#macro _m'.match(macroDefRe('_m'))).toBeNull();
		expect('set( _t = 1 )'.match(actionBlockDefRe('_t'))).toBeNull();
	});

	test('reference factories still match a "_name" usage', () => {
		expect('if ( _finished eq 1 )'.match(checkRe('_finished'))).not.toBeNull();
		expect(
			'x = _finished + 1'.match(new RegExp(getWordDefinition('_finished'))),
		).not.toBeNull();
	});
});
