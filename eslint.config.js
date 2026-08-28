'use strict';

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
	{
		ignores: [
			'out/**',
			'node_modules/**',
			'esbuild.js',
			'eslint.config.js',
			'.eslintrc.js',
			'tools/**',
			'**/*.d.ts',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	prettier,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-empty-function': 'off',
			curly: 'warn',
			'no-throw-literal': 'warn',
			eqeqeq: ['warn', 'smart'],
		},
	},
);
