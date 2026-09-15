import {
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
