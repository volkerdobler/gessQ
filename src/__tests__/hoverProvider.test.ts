import { disambiguateKeyword } from '../providers/hoverProvider';

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
