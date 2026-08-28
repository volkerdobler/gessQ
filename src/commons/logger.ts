import * as vscode from 'vscode';

let out: vscode.OutputChannel | null = null;

export function setOutputChannel(channel?: vscode.OutputChannel) {
	out = channel || null;
}

function enabled(): boolean {
	try {
		return (
			vscode.workspace
				.getConfiguration('gessq')
				.get<boolean>('debugMode', false) === true
		);
	} catch (e) {
		return false;
	}
}

export function debug(msg: string) {
	if (!enabled()) {
		return;
	}
	if (out) {
		out.appendLine('[debug] ' + msg);
	} else {
		console.log('[debug] ' + msg);
	}
}

export function info(msg: string) {
	if (!enabled()) {
		return;
	}
	if (out) {
		out.appendLine('[info] ' + msg);
	} else {
		console.log('[info] ' + msg);
	}
}

export function warn(msg: string) {
	if (!enabled()) {
		return;
	}
	if (out) {
		out.appendLine('[warn] ' + msg);
	} else {
		console.warn('[warn] ' + msg);
	}
}

export function error(msg: string) {
	// always log errors regardless of enabled state to make debugging easier
	if (out) {
		out.appendLine('[error] ' + msg);
	} else {
		console.error('[error] ' + msg);
	}
}
