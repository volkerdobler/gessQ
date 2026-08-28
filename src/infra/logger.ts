'use strict';

import * as vscode from 'vscode';

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const RANK: Record<LogLevel, number> = {
	off: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
};

let channel: vscode.OutputChannel | null = null;
let level: LogLevel = 'error';

/**
 * Register the Output channel the logger writes to. Pass `undefined` to fall
 * back to `console`.
 */
export function setOutputChannel(c?: vscode.OutputChannel): void {
	channel = c ?? null;
}

/** Set the active log level explicitly (mainly for tests). */
export function setLogLevel(l: LogLevel): void {
	level = l;
}

/**
 * Refresh the active log level from configuration. Prefers `gessq.logLevel`;
 * falls back to the deprecated `gessq.debugMode` boolean.
 */
export function refreshLogLevelFromConfig(): void {
	try {
		const cfg = vscode.workspace.getConfiguration('gessq');
		const explicit = cfg.get<LogLevel>('logLevel');
		if (explicit && explicit in RANK) {
			level = explicit;
			return;
		}
		level = cfg.get<boolean>('debugMode', false) ? 'debug' : 'error';
	} catch {
		level = 'error';
	}
}

function write(msgLevel: Exclude<LogLevel, 'off'>, msg: string): void {
	if (RANK[msgLevel] > RANK[level]) {
		return;
	}
	const line = '[' + msgLevel + '] ' + msg;
	if (channel) {
		channel.appendLine(line);
	} else {
		console.log(line);
	}
}

export const error = (msg: string): void => write('error', msg);
export const warn = (msg: string): void => write('warn', msg);
export const info = (msg: string): void => write('info', msg);
export const debug = (msg: string): void => write('debug', msg);
