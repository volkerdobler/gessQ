import {
	compareVersions,
	pendingVersions,
	releaseNotesPath,
	shouldShowReleaseNotes,
} from '../infra/releaseNotes';

describe('releaseNotesPath', () => {
	test('is release-notes/<version>.md', () => {
		expect(releaseNotesPath('1.2.3')).toBe('release-notes/1.2.3.md');
		expect(releaseNotesPath('0.99.0')).toBe('release-notes/0.99.0.md');
	});
});

describe('shouldShowReleaseNotes', () => {
	test('setting on, never suppressed (fresh install / update) → yes', () => {
		expect(shouldShowReleaseNotes(true, undefined)).toBe(true);
	});

	test('setting on, checkbox left unchecked last time → yes', () => {
		expect(shouldShowReleaseNotes(true, false)).toBe(true);
	});

	test('setting on, checkbox checked for this version → no', () => {
		expect(shouldShowReleaseNotes(true, true)).toBe(false);
	});

	test('setting off, regardless of checkbox state → no', () => {
		expect(shouldShowReleaseNotes(false, undefined)).toBe(false);
		expect(shouldShowReleaseNotes(false, true)).toBe(false);
	});
});

describe('compareVersions', () => {
	test('orders by numeric major.minor.patch, not lexically', () => {
		expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
		expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
		expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
		expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
	});
});

describe('pendingVersions', () => {
	const available = ['1.0.0', '1.0.1'];

	test('setting off → nothing pending, regardless of suppress state', () => {
		expect(pendingVersions(available, '1.0.1', false, () => undefined)).toEqual(
			[],
		);
	});

	test('fresh update from 0.99.3 straight to 1.0.1 → both 1.0.0 and 1.0.1 owed, oldest first', () => {
		expect(pendingVersions(available, '1.0.1', true, () => undefined)).toEqual(
			['1.0.0', '1.0.1'],
		);
	});

	test('a version already seen (suppressed) at update time is skipped', () => {
		const suppressed = new Set(['1.0.0']);
		expect(
			pendingVersions(available, '1.0.1', true, (v) => suppressed.has(v)),
		).toEqual(['1.0.1']);
	});

	test('versions newer than the installed one are never pending', () => {
		expect(pendingVersions(available, '1.0.0', true, () => undefined)).toEqual(
			['1.0.0'],
		);
	});
});
