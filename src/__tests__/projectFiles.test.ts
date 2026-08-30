import * as vscode from 'vscode';
import { isRootScript, includeClosure } from '../core/projectFiles';
import type { IncludeDirective } from '../core/includes';

const u = (p: string) => vscode.Uri.file(p);

describe('isRootScript', () => {
	test('matches exactly "script.q" (any folder, case-insensitive)', () => {
		expect(isRootScript(u('/ws/script.q'))).toBe(true);
		expect(isRootScript(u('/ws/study/script.q'))).toBe(true);
		expect(isRootScript(u('/ws/SCRIPT.Q'))).toBe(true);
	});

	test('rejects versioned / prefixed copies', () => {
		expect(isRootScript(u('/ws/script_v1.q'))).toBe(false);
		expect(isRootScript(u('/ws/old_script.q'))).toBe(false);
		expect(isRootScript(u('/ws/script.q.bak'))).toBe(false);
		expect(isRootScript(u('/ws/scripts/labels.q'))).toBe(false);
	});
});

describe('includeClosure', () => {
	/** Build a fake `readIncludes` from a path → include-target-paths map. */
	function reader(map: Record<string, string[] | null>) {
		return async (uri: vscode.Uri) => {
			const targets = map[uri.path];
			if (targets == null) {
				return undefined; // file missing / unreadable
			}
			return targets.map(
				(p) =>
					({ resolved: u(p) }) as unknown as IncludeDirective,
			);
		};
	}

	test('follows #include transitively, breadth-first, once each', async () => {
		const files = await includeClosure(
			[u('/p/script.q')],
			reader({
				'/p/script.q': ['/p/a.q', '/p/b.q'],
				'/p/a.q': ['/p/c.q'],
				'/p/b.q': ['/p/c.q'],
				'/p/c.q': [],
			}),
		);
		expect(files.map((f) => f.path)).toEqual([
			'/p/script.q',
			'/p/a.q',
			'/p/b.q',
			'/p/c.q',
		]);
	});

	test('skips missing files (e.g. #includeifexists targets)', async () => {
		const files = await includeClosure(
			[u('/p/script.q')],
			reader({
				'/p/script.q': ['/p/there.q', '/p/gone.q'],
				'/p/there.q': [],
				'/p/gone.q': null,
			}),
		);
		expect(files.map((f) => f.path)).toEqual([
			'/p/script.q',
			'/p/there.q',
		]);
	});

	test('handles include cycles', async () => {
		const files = await includeClosure(
			[u('/p/script.q')],
			reader({
				'/p/script.q': ['/p/a.q'],
				'/p/a.q': ['/p/script.q'],
			}),
		);
		expect(files.map((f) => f.path)).toEqual(['/p/script.q', '/p/a.q']);
	});

	test('a stale copy outside the closure is never reached', async () => {
		const files = await includeClosure(
			[u('/p/script.q')],
			reader({
				'/p/script.q': ['/p/q1.q'],
				'/p/q1.q': [],
				'/p/script_v1.q': ['/p/q1_old.q'],
				'/p/q1_old.q': [],
			}),
		);
		expect(files.map((f) => f.path)).toEqual(['/p/script.q', '/p/q1.q']);
	});
});
