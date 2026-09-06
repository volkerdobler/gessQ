'use strict';

/**
 * Build script for the GESS Q. extension.
 *
 *   node esbuild.js               – one-off development build
 *   node esbuild.js --watch       – rebuild on change
 *   node esbuild.js --production   – minified build for packaging
 *
 * Besides bundling `src/extension.ts` into `out/extension.js`, this copies the
 * runtime data assets the providers read at runtime (the manual glossary and
 * the embedded-JS ambient globals `gessq-globals.d.ts`) next to the bundle so
 * they are resolvable via `context.extensionUri` both in the dev host and in a
 * packaged .vsix. `.vscodeignore` re-includes `out/gessq-globals.d.ts` past its
 * blanket TypeScript-file exclude.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** Files copied verbatim into `out/`. Source path -> output basename. */
const ASSETS = [
	['src/data/manualGlossary.json', 'manualGlossary.json'],
	['assets/gessq-globals.d.ts', 'gessq-globals.d.ts'],
];

/** esbuild plugin: copy the data assets after every (re)build. */
const copyAssetsPlugin = {
	name: 'copy-assets',
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length > 0) return;
			fs.mkdirSync('out', { recursive: true });
			for (const [from, to] of ASSETS) {
				fs.copyFileSync(from, path.join('out', to));
			}
			console.log(`[build] assets copied (${ASSETS.length})`);
		});
	},
};

/** @type {import('esbuild').BuildOptions} */
const options = {
	entryPoints: ['src/extension.ts'],
	bundle: true,
	outfile: 'out/extension.js',
	external: ['vscode'],
	format: 'cjs',
	platform: 'node',
	target: 'node18',
	sourcemap: !production,
	minify: production,
	logLevel: 'info',
	plugins: [copyAssetsPlugin],
};

async function main() {
	if (watch) {
		const ctx = await esbuild.context(options);
		await ctx.watch();
		console.log('[build] watching for changes…');
	} else {
		await esbuild.build(options);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
