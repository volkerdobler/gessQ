import {
	compareVersions,
	latestVersion,
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

describe('latestVersion', () => {
	test('no notes files at all → undefined', () => {
		expect(latestVersion([])).toBeUndefined();
	});

	test('a single file → that version', () => {
		expect(latestVersion(['1.0.0'])).toBe('1.0.0');
	});

	test('picks the numerically newest, regardless of list order', () => {
		expect(latestVersion(['1.0.0', '1.0.10', '1.0.9'])).toBe('1.0.10');
		expect(latestVersion(['1.0.10', '1.0.9', '1.0.0'])).toBe('1.0.10');
	});
});
