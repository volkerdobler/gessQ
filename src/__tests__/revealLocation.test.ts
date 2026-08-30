import { REVEAL_COMMAND, revealLink } from '../providers/revealLocation';

describe('revealLink', () => {
	test('builds a command: link whose args round-trip', () => {
		const link = revealLink('sub/a.q:6', 'file:///ws/sub/a.q', 5, 8);
		const m = link.match(
			/^\[sub\/a\.q:6\]\(command:([^?]+)\?(.+)\)$/,
		);
		expect(m).not.toBeNull();
		expect(m![1]).toBe(REVEAL_COMMAND);
		expect(JSON.parse(decodeURIComponent(m![2]))).toEqual([
			'file:///ws/sub/a.q',
			5,
			8,
		]);
	});

	test('encodes so "&", "?", spaces in the path cannot break the URI', () => {
		const link = revealLink('x', 'file:///a b/q?x&y.q', 0, 0);
		const args = link.slice(link.indexOf('?') + 1, -1);
		expect(args).not.toMatch(/[?&\s]/);
		expect(JSON.parse(decodeURIComponent(args))[0]).toBe(
			'file:///a b/q?x&y.q',
		);
	});
});
