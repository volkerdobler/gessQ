import { detectContext } from '../providers/completionProvider';

const kind = (prefix: string) => detectContext(prefix).kind;

describe('detectContext', () => {
	test('bare text → default', () => {
		expect(kind('singleq Fra')).toBe('default');
		expect(kind('')).toBe('default');
		expect(kind('  ')).toBe('default');
	});

	test('after # → hash directive', () => {
		expect(kind('#')).toBe('hashDirective');
		expect(kind('#inc')).toBe('hashDirective');
		expect(kind('   #ifd')).toBe('hashDirective');
	});

	test('after @ → at directive', () => {
		expect(kind('@')).toBe('atDirective');
		expect(kind('@ins')).toBe('atDirective');
	});

	test('after & → macro reference', () => {
		expect(kind('&')).toBe('macroRef');
		expect(kind('&label')).toBe('macroRef');
		expect(kind('text="foo &lab')).toBe('macroRef');
	});

	test('after #domacro → macro reference', () => {
		expect(kind('#domacro ')).toBe('macroRef');
		expect(kind('#domacro my')).toBe('macroRef');
	});

	test('&& (logical and) is not a macro reference', () => {
		expect(kind('if (a && b')).toBe('default');
	});

	test('after "rendering =" → rendering value', () => {
		expect(kind('rendering = ')).toBe('renderingValue');
		expect(kind('rendering=thy')).toBe('renderingValue');
		expect(kind('  rendering  =  html')).toBe('renderingValue');
		expect(kind('rendering = "')).toBe('renderingValue');
		expect(kind('rendering')).toBe('default');
		expect(kind('rendering = thymeleaf;')).toBe('default');
	});
});
