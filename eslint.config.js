//@ts-check
import eslintJsPlugin from '@eslint/js';
import eslintStylisticPlugin from '@stylistic/eslint-plugin';
import * as eslintImportPlugin from 'eslint-plugin-import';
import eslintReactPlugin from 'eslint-plugin-react';
import eslintReactHooksPlugin from 'eslint-plugin-react-hooks';
import { join } from 'path';
import tsEslint from 'typescript-eslint';

export default tsEslint.config(
	{
		ignores: [
			'pandora-*/dist/**',
			'pandora-tests/temp',
			'pandora-tests/test-results',
			'pandora-tests/playwright',
			'pandora-tests/playwright-report',
		],
	},
	{
		name: 'pandora/base',
		files: [
			'**/*.js',
			'**/*.cjs',
			'**.*.mjs',
			'**/*.ts',
			'**/*.tsx',
		],
		extends: [
			eslintJsPlugin.configs.recommended,
			eslintImportPlugin.flatConfigs?.recommended,
			eslintImportPlugin.flatConfigs?.typescript,
			tsEslint.configs.recommended,
			tsEslint.configs.stylistic,
		],
		plugins: {
			'@typescript-eslint': tsEslint.plugin,
			'@stylistic': eslintStylisticPlugin,
		},
		languageOptions: {
			ecmaVersion: 2023,
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'warn',
		},
		rules: {
			// Disabled recommended rules
			'@typescript-eslint/no-inferrable-types': 'off',
			'import/no-unresolved': 'off', // Breaks with "exports" mappings (https://github.com/import-js/eslint-plugin-import/issues/2703)
			// NOs
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{
					'ts-expect-error': 'allow-with-description',
				},
			],
			'@typescript-eslint/parameter-properties': 'error',
			'eqeqeq': [
				'error',
				'always',
				{
					'null': 'ignore',
				},
			],
			'no-bitwise': 'error',
			'no-eval': 'error',
			'no-console': 'error',
			'no-shadow': 'off',
			'@typescript-eslint/no-shadow': [
				'error',
				{
					'hoist': 'all',
				},
			],
			'no-var': 'error',
			'unicode-bom': 'error',
			// Warnings
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					'varsIgnorePattern': '^__satisfies__',
					'argsIgnorePattern': '^_',
					'caughtErrorsIgnorePattern': '^_',
				},
			],
			'no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/prefer-for-of': 'warn',
			'prefer-const': 'warn',
			'no-undef-init': 'warn',
			'object-shorthand': 'warn',
			'no-multiple-empty-lines': ['warn', { 'max': 1, 'maxBOF': 0, 'maxEOF': 1 }],
			'operator-assignment': 'warn',
			'prefer-object-spread': 'warn',
			'import/no-cycle': 'warn',
			'import/no-internal-modules': ['error', {
				forbid: [
					'pandora-common/src/**',
					'zod/**',
				],
			}],
			'import/no-extraneous-dependencies': ['warn', {
				'devDependencies': [
					'.hooks/**',
					'**/eslint.config.js',
					'**/pandora-tests/**/*.ts',
					'**/pandora-*/test/**',
					'**/pandora-client-web/webpack.config.ts',
				],
			}],
			'no-restricted-syntax': ['warn',
				{
					message: "Do not import z namespace from zod. Use `import * as z from 'zod';` instead.",
					// Reason for this is to allow better tree-shaking
					selector: 'ImportDeclaration[source.value="zod"] ImportSpecifier Identifier[name="z"]',
				},
			],
			// Stylistic rules
			'@stylistic/semi': ['warn', 'always'],
			'@stylistic/semi-style': ['warn', 'last'],
			'@stylistic/semi-spacing': 'warn',
			'@stylistic/no-extra-semi': 'warn',
			'@stylistic/indent': [
				'warn',
				'tab',
				{
					SwitchCase: 1,
					flatTernaryExpressions: true,
					ignoredNodes: [
						'ConditionalExpression',
					],
				},
			],
			'@stylistic/comma-dangle': ['warn', 'always-multiline'],
			'@stylistic/member-delimiter-style': [
				'warn',
				{
					'singleline': {
						'requireLast': true,
					},
				},
			],
			'@stylistic/quotes': ['warn', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': 'always' }],
			'@stylistic/jsx-quotes': ['warn', 'prefer-single'],
			'@stylistic/brace-style': ['warn', '1tbs'],
			'@stylistic/space-before-function-paren': [
				'warn',
				{
					'anonymous': 'always',
					'named': 'never',
					'asyncArrow': 'always',
				},
			],
			'@stylistic/comma-spacing': 'warn',
			'@stylistic/function-call-spacing': 'warn',
			'@stylistic/type-annotation-spacing': 'warn',
			'@stylistic/keyword-spacing': 'warn',
			'@stylistic/object-curly-spacing': ['warn', 'always'],
			'@stylistic/space-infix-ops': 'warn',
			'@stylistic/no-tabs': ['warn', { 'allowIndentationTabs': true }],
			'@stylistic/no-trailing-spaces': 'warn',
			'@stylistic/array-bracket-spacing': ['warn', 'never'],
			'@stylistic/no-multi-spaces': 'warn',
			'@stylistic/comma-style': 'warn',
			'@stylistic/computed-property-spacing': 'warn',
			'@stylistic/eol-last': 'warn',
			'@stylistic/key-spacing': 'warn',
			'@stylistic/linebreak-style': ['warn', 'unix'],
			'@stylistic/no-whitespace-before-property': 'warn',
			'@stylistic/object-curly-newline': ['warn', { 'multiline': true, 'consistent': true }],
			'@stylistic/quote-props': ['warn', 'consistent'],
			'@stylistic/space-before-blocks': 'warn',
			'@stylistic/space-in-parens': 'warn',
			'@stylistic/switch-colon-spacing': 'warn',
			'@stylistic/arrow-spacing': 'warn',
			'@stylistic/arrow-parens': ['warn', 'always'],
			// Other style rules
			'dot-notation': 'warn',
			'@typescript-eslint/array-type': 'warn',
			'@typescript-eslint/consistent-type-assertions': [
				'warn',
				{
					'assertionStyle': 'as',
					'objectLiteralTypeAssertions': 'never',
				},
			],
			'@typescript-eslint/prefer-function-type': 'warn',
			'one-var': ['warn', 'never'],
		},
	},
	{
		name: 'pandora/ts',
		files: [
			'**/*.ts',
			'**/*.tsx',
		],
		extends: [
			tsEslint.configs.recommendedTypeChecked,
			tsEslint.configs.stylisticTypeChecked,
		],
		plugins: {
			'@typescript-eslint': tsEslint.plugin,
			'@stylistic': eslintStylisticPlugin,
		},
		languageOptions: {
			parser: tsEslint.parser,
			sourceType: 'module',
			parserOptions: {
				projectService: true,
				sourceType: 'module',
			},
		},
		rules: {
			// TODO: Temporarily disabled rules after migration
			'@typescript-eslint/consistent-generic-constructors': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-duplicate-type-constituents': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/non-nullable-type-assertion-style': 'off',
			'@typescript-eslint/prefer-optional-chain': 'off',
			'@typescript-eslint/prefer-string-starts-ends-with': 'off',
			// Disabled recommended rules
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			'import/namespace': 'off', // TypeScript ensures the validity better
			// NOs
			'@typescript-eslint/only-throw-error': 'error',
			// Warnings
			'@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
			'@typescript-eslint/no-deprecated': 'warn',
			// Style rules
			'dot-notation': 'off',
			'@typescript-eslint/dot-notation': 'warn',
			'@typescript-eslint/explicit-member-accessibility': ['warn', {
				'accessibility': 'explicit',
				'overrides': {
					'constructors': 'no-public',
				},
			}],
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					'selector': 'default',
					'format': ['camelCase'],
					'leadingUnderscore': 'allow',
					'trailingUnderscore': 'allow',
				},
				{
					'selector': 'variable',
					'modifiers': ['const'],
					'format': ['camelCase', 'UPPER_CASE'],
					'leadingUnderscore': 'forbid',
				},
				{
					'selector': 'function',
					'modifiers': ['global'],
					'format': ['PascalCase'],
				},
				{
					'selector': 'variable',
					'modifiers': ['global'],
					'format': ['camelCase', 'PascalCase'],
				},
				{
					'selector': 'variable',
					'modifiers': ['const', 'global'],
					'format': ['camelCase', 'PascalCase', 'UPPER_CASE'],
				},
				{
					'selector': 'variable',
					'format': ['UPPER_CASE'],
					'leadingUnderscore': 'allow',
					'modifiers': ['const', 'global'],
					'types': ['boolean', 'string', 'number'],
				},
				{
					'selector': ['variable', 'parameter'],
					'format': null,
					'modifiers': ['destructured'],
				},
				{
					'selector': 'parameter',
					'modifiers': ['unused'],
					'format': ['camelCase'],
					'leadingUnderscore': 'allow',
				},
				{
					'selector': 'import',
					'format': null,
				},
				{
					'selector': ['objectLiteralProperty', 'objectLiteralMethod'],
					'format': null,
				},
				{
					'selector': 'typeLike',
					'format': ['PascalCase'],
				},
				{
					'selector': 'typeLike',
					'format': null,
					'filter': {
						'regex': '^__satisfies__',
						'match': true,
					},
				},
				{
					'selector': 'enumMember',
					'format': ['UPPER_CASE'],
				},
			],
		},
	},
	{
		name: 'pandora/servers',
		files: [
			'pandora-server-directory/**/*.ts',
			'pandora-server-shard/**/*.ts',
		],
		rules: {
			// Disabled recommended rules
			'import/no-cycle': 'off',
		},
	},
	{
		name: 'pandora/client/base',
		files: [
			'pandora-client-web/**/*.js',
			'pandora-client-web/**/*.cjs',
			'pandora-client-web/**.*.mjs',
			'pandora-client-web/**/*.ts',
			'pandora-client-web/**/*.tsx',
		],
		extends: [
			eslintReactPlugin.configs.flat.recommended,
			eslintReactPlugin.configs.flat['jsx-runtime'],
		],
		plugins: {
			'react': eslintReactPlugin,
			'react-hooks': eslintReactHooksPlugin,
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			// Disabled recommended rules
			'import/no-cycle': 'off',
			'react/prop-types': 'off',
			// NOs
			'react/no-unsafe': ['error', { 'checkAliases': true }],
			'react/no-unstable-nested-components': 'error',
			'react/jsx-no-script-url': 'error',
			'react-hooks/rules-of-hooks': 'error',
			'no-restricted-globals': [
				'error',
				{
					'name': 'close',
					'message': 'Calling global `close` closes the tab. If you really want to do this, then use `window.close`.',
				},
			],
			// Warnings
			'react-hooks/exhaustive-deps': 'warn',
			'no-alert': 'warn',
			'react/default-props-match-prop-types': 'warn',
			'react/no-typos': 'warn',
			'react/prefer-stateless-function': 'warn',
			'react/style-prop-object': 'warn',
			'react/void-dom-elements-no-children': 'warn',
			'react/jsx-no-constructed-context-values': 'warn',
			'react/jsx-no-useless-fragment': ['warn', { 'allowExpressions': true }],
			// Stylistic rules
			'@stylistic/jsx-closing-tag-location': 'warn',
			'@stylistic/jsx-curly-newline': ['warn', 'consistent'],
			'@stylistic/jsx-curly-spacing': ['warn', { 'when': 'always', 'children': true }],
			'@stylistic/jsx-equals-spacing': ['warn', 'never'],
			'@stylistic/jsx-pascal-case': 'warn',
			'@stylistic/jsx-tag-spacing': 'warn',
			'@stylistic/jsx-wrap-multilines': [
				'warn',
				{
					'declaration': 'parens-new-line',
					'assignment': 'parens-new-line',
					'return': 'parens-new-line',
					'arrow': 'parens-new-line',
					'condition': 'ignore',
					'logical': 'ignore',
					'prop': 'ignore',
				},
			],
			// Other style rules
			'react/destructuring-assignment': ['warn', 'always'],
			'react/jsx-filename-extension': ['warn', { 'extensions': ['.jsx', '.tsx'] }],
			'react/no-unescaped-entities': [
				'warn',
				{
					'forbid': [
						{
							'char': '>',
							'alternatives': ['&gt;'],
						},
						{
							'char': '}',
							'alternatives': ['&#125;'],
						},
					],
				},
			],
			'react/forbid-elements': [
				'warn',
				{
					'forbid': [
						{ 'element': 'select', 'message': 'use <Select> instead' },
						{ 'element': 'input', 'message': 'use one of the following instead: <Checkbox>, <TextInput>, <NumberInput>, <ColorInput>, <FormInput>' },
					],
				},
			],
		},
	},
	{
		name: 'pandora/client/ts',
		files: [
			'pandora-client-web/**/*.ts',
			'pandora-client-web/**/*.tsx',
		],
		rules: {
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					'selector': 'default',
					'format': ['camelCase'],
					'leadingUnderscore': 'allow',
					'trailingUnderscore': 'allow',
				},
				{
					'selector': 'variableLike',
					'format': ['camelCase', 'PascalCase'],
					'leadingUnderscore': 'forbid',
				},
				{
					'selector': 'variable',
					'modifiers': ['const'],
					'format': ['camelCase', 'PascalCase', 'UPPER_CASE'],
					'leadingUnderscore': 'forbid',
				},
				{
					'selector': 'function',
					'modifiers': ['global'],
					'format': ['PascalCase'],
				},
				{
					'selector': 'function',
					'modifiers': ['global'],
					'format': ['camelCase'],
					'filter': {
						'regex': '^use',
						'match': true,
					},
				},
				{
					'selector': 'variable',
					'modifiers': ['global'],
					'format': ['camelCase', 'PascalCase'],
				},
				{
					'selector': 'variable',
					'modifiers': ['const', 'global'],
					'format': ['camelCase', 'PascalCase', 'UPPER_CASE'],
				},
				{
					'selector': 'variable',
					'format': ['UPPER_CASE'],
					'leadingUnderscore': 'allow',
					'modifiers': ['const', 'global'],
					'types': ['boolean', 'string', 'number'],
				},
				{
					'selector': ['variable', 'parameter'],
					'format': null,
					'modifiers': ['destructured'],
				},
				{
					'selector': 'parameter',
					'modifiers': ['unused'],
					'format': ['camelCase'],
					'leadingUnderscore': 'allow',
				},
				{
					'selector': 'import',
					'format': null,
				},
				{
					'selector': ['objectLiteralProperty', 'objectLiteralMethod'],
					'format': null,
				},
				{
					'selector': 'typeLike',
					'format': null,
					'filter': {
						'regex': '^__satisfies__',
						'match': true,
					},
				},
				{
					'selector': 'typeLike',
					'format': ['PascalCase'],
				},
				{
					'selector': 'enumMember',
					'format': ['UPPER_CASE'],
				},
			],
		},
	},
	// Some of our files cannot have their projects resolved by project service,
	// but still have valid config that should be used
	{
		name: 'pandora/client/webpack',
		files: [
			'pandora-client-web/webpack.config.ts',
		],
		languageOptions: {
			parserOptions: {
				projectService: false,
				project: [
					join(import.meta.dirname, './pandora-client-web/tsconfig.webpack.json'),
				],
			},
		},
	},
	{
		name: 'pandora/client/tests-setup',
		files: [
			'pandora-client-web/test/setup.ts',
		],
		languageOptions: {
			parserOptions: {
				projectService: false,
				project: [
					join(import.meta.dirname, './pandora-client-web/test/tsconfig.setup.json'),
				],
			},
		},
	},
	{
		name: 'pandora/tests-setup',
		files: [
			'pandora-tests/playwright.config.ts',
		],
		languageOptions: {
			parserOptions: {
				projectService: false,
				project: [
					join(import.meta.dirname, './pandora-tests/tsconfig.json'),
				],
			},
		},
	},
);
