//@ts-check

import * as path from 'path';

/**
 * @param { string } project
 * @param { import('ts-jest').JestConfigWithTsJest } [config]
 * @returns { (import('jest').Config['projects'] & {})[number] }
 */
function DefineProjectConfig(project, config) {
	return {
		displayName: project,
		rootDir: path.join(import.meta.dirname, project),

		testMatch: [
			'<rootDir>/test/**/*.test.?([mc])[jt]s?(x)',
		],
		clearMocks: true,
		errorOnDeprecated: true,
		setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
		extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
		transform: {
			'^.+\\.tsx?$': ['ts-jest', {
				tsconfig: '<rootDir>/test/tsconfig.json',
				useESM: true,
			}],
		},
		...(config ?? {}),
	};
}

/**
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * @type { import('jest').Config }
 */
export default {
	projects: [
		DefineProjectConfig('pandora-common'),
		DefineProjectConfig('pandora-server-directory', {
			watchPathIgnorePatterns: ['globalConfig'],
		}),
		DefineProjectConfig('pandora-server-shard'),
		DefineProjectConfig('pandora-client-web', {
			moduleNameMapper: {
				'\\.(png|jpe?g|gif|svg|eot|ttf|woff2?|mp3|wav)$': '<rootDir>/test/stubs/resourceStub.ts',
				'\\.s?css$': '<rootDir>/test/stubs/stylesheetStub.ts',
				'react-reverse-portal': '<rootDir>/node_modules/react-reverse-portal/dist/cjs/index.js',
			},
			testEnvironment: 'jsdom',
		}),
		DefineProjectConfig('pandora-api'),
		DefineProjectConfig('pandora-cli'),
	],
	coverageProvider: 'v8',
	coverageDirectory: 'coverage_jest',
	coverageReporters: [
		'html',
		'json',
		'text-summary',
	],
	collectCoverageFrom: [
		'**/pandora-*/src/**/*.{ts,tsx}',
		'!**/node_modules/**',
	],
	errorOnDeprecated: true,
};
