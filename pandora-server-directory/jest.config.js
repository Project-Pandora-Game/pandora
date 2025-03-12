// @ts-check
/* eslint-env node */
/**
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * @type { import('ts-jest').JestConfigWithTsJest }
 */
export default {
	clearMocks: true,
	collectCoverageFrom: [
		'src/**/*.ts',
		'src/**/*.tsx',
		'!src/index.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: [
		'html',
		'json',
		'text-summary',
	],
	coverageProvider: 'v8',
	errorOnDeprecated: true,
	watchPathIgnorePatterns: ['globalConfig'],
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: './test/tsconfig.json',
			isolatedModules: true,
			useESM: true,
		}],
	},
};
