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
	test('fresh install (nothing stored)', () => {
		expect(shouldShowReleaseNotes(undefined, '1.0.0')).toBe(true);
	});

	test('update from an older version', () => {
		expect(shouldShowReleaseNotes('0.99.0', '1.0.0')).toBe(true);
	});

	test('same version already shown → no', () => {
		expect(shouldShowReleaseNotes('1.0.0', '1.0.0')).toBe(false);
	});

	test('missing version string → no', () => {
		expect(shouldShowReleaseNotes(undefined, '')).toBe(false);
	});
});
