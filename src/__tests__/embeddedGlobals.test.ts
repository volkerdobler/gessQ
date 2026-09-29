import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	resolveDeclarationPath,
	loadUserDeclarations,
} from '../data/embeddedGlobals';
import { embeddedDeclarationFiles } from '../infra/config';

const HOME = path.resolve('/home/me');
const WS = path.resolve('/ws/project');

describe('resolveDeclarationPath', () => {
	test('absolute paths are kept (normalised)', () => {
		const abs = path.resolve('/x/y/../seqdot.d.ts');
		expect(resolveDeclarationPath(abs, WS, HOME)).toBe(
			path.resolve('/x/seqdot.d.ts'),
		);
	});

	test('~ and ${userHome} expand to the home dir', () => {
		expect(resolveDeclarationPath('~/types/a.d.ts', WS, HOME)).toBe(
			path.join(HOME, 'types', 'a.d.ts'),
		);
		expect(resolveDeclarationPath('${userHome}/a.d.ts', WS, HOME)).toBe(
			path.join(HOME, 'a.d.ts'),
		);
	});

	test('${workspaceFolder} and relative paths resolve against the workspace', () => {
		expect(
			resolveDeclarationPath('${workspaceFolder}/types/a.d.ts', WS, HOME),
		).toBe(path.join(WS, 'types', 'a.d.ts'));
		expect(resolveDeclarationPath('types/a.d.ts', WS, HOME)).toBe(
			path.join(WS, 'types', 'a.d.ts'),
		);
	});

	test('workspace-relative paths without a workspace are unresolvable', () => {
		expect(resolveDeclarationPath('types/a.d.ts', undefined, HOME)).toBe(
			undefined,
		);
		expect(
			resolveDeclarationPath('${workspaceFolder}/a.d.ts', undefined, HOME),
		).toBe(undefined);
	});
});

describe('loadUserDeclarations', () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gessq-decl-'));
	});
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('reads a file and watches it', () => {
		const file = path.join(dir, 'seqdot.d.ts');
		fs.writeFileSync(file, 'declare var SEQdot: any;');
		const r = loadUserDeclarations([file], undefined, HOME);
		expect(r.text).toContain('declare var SEQdot: any;');
		expect(r.text).toContain('// --- ' + file + ' ---');
		expect(r.watch).toEqual([{ dir, pattern: 'seqdot.d.ts' }]);
	});

	test('a folder contributes its *.d.ts files in name order', () => {
		fs.writeFileSync(path.join(dir, 'b.d.ts'), 'interface B {}');
		fs.writeFileSync(path.join(dir, 'a.d.ts'), 'interface A {}');
		fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
		const r = loadUserDeclarations([dir], undefined, HOME);
		expect(r.text.indexOf('interface A')).toBeGreaterThanOrEqual(0);
		expect(r.text.indexOf('interface A')).toBeLessThan(
			r.text.indexOf('interface B'),
		);
		expect(r.text).not.toContain('ignored');
		expect(r.watch).toEqual([{ dir, pattern: '*.d.ts' }]);
	});

	test('a missing file is skipped but still watched', () => {
		const file = path.join(dir, 'later.d.ts');
		const r = loadUserDeclarations([file], undefined, HOME);
		expect(r.text).toBe('');
		expect(r.watch).toEqual([{ dir, pattern: 'later.d.ts' }]);
	});

	test('an unresolvable relative path is skipped entirely', () => {
		const r = loadUserDeclarations(['rel.d.ts'], undefined, HOME);
		expect(r).toEqual({ text: '', watch: [] });
	});
});

describe('embeddedDeclarationFiles', () => {
	const real = vscode.workspace.getConfiguration;
	afterEach(() => {
		(vscode.workspace as { getConfiguration: unknown }).getConfiguration =
			real;
	});

	function stub(value: unknown): void {
		(vscode.workspace as { getConfiguration: unknown }).getConfiguration =
			() => ({
				get: <T>(_k: string, d?: T): T | undefined =>
					value === undefined ? d : (value as T),
			});
	}

	test('defaults to an empty list', () => {
		stub(undefined);
		expect(embeddedDeclarationFiles()).toEqual([]);
	});

	test('drops non-strings and blanks, trims the rest', () => {
		stub([' a.d.ts ', '', 3, null, 'b']);
		expect(embeddedDeclarationFiles()).toEqual(['a.d.ts', 'b']);
	});

	test('a non-array value yields an empty list', () => {
		stub('a.d.ts');
		expect(embeddedDeclarationFiles()).toEqual([]);
	});
});
