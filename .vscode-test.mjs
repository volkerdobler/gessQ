import { defineConfig } from '@vscode/test-cli';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Extension-host integration tests (Mocha). Compiled from `src/test/` to
// `out-test/` by `npm run compile:test`; the extension bundle from
// `node esbuild.js` – both wired up by the `pretest:integration` script.
export default defineConfig({
	files: 'out-test/**/*.test.js',
	version: 'stable',
	extensionDevelopmentPath: root,
	workspaceFolder: `${root}src/test/fixtures`,
	mocha: {
		ui: 'tdd',
		timeout: 60000,
		color: true,
	},
});
