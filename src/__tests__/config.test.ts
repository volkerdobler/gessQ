import * as vscode from 'vscode';
import {
	hoverEnabled,
	hoverReferenceDetail,
	codeLensEnabled,
	diagnosticsEnabled,
} from '../infra/config';

const realGetConfiguration = vscode.workspace.getConfiguration;

afterEach(() => {
	(vscode.workspace as { getConfiguration: unknown }).getConfiguration =
		realGetConfiguration;
});

function stubConfig(values: Record<string, unknown>): void {
	(vscode.workspace as { getConfiguration: unknown }).getConfiguration =
		() => ({
			get<T>(key: string, defaultValue?: T): T | undefined {
				return key in values ? (values[key] as T) : defaultValue;
			},
		});
}

describe('config toggles', () => {
	test('default to true when unset', () => {
		stubConfig({});
		expect(hoverEnabled()).toBe(true);
		expect(codeLensEnabled()).toBe(true);
		expect(diagnosticsEnabled()).toBe(true);
	});

	test('honour an explicit false', () => {
		stubConfig({ 'hover.enable': false, 'codeLens.enable': false });
		expect(hoverEnabled()).toBe(false);
		expect(codeLensEnabled()).toBe(false);
	});

	test('hover.referenceDetail: default "summary", known values pass, junk falls back', () => {
		stubConfig({});
		expect(hoverReferenceDetail()).toBe('summary');
		for (const v of ['off', 'summary', 'definition', 'full'] as const) {
			stubConfig({ 'hover.referenceDetail': v });
			expect(hoverReferenceDetail()).toBe(v);
		}
		stubConfig({ 'hover.referenceDetail': 'nonsense' });
		expect(hoverReferenceDetail()).toBe('summary');
	});
});
