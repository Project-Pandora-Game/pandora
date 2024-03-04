/**
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * @type { import('jest').Config }
 */
module.exports = {
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
	errorOnDeprecated: true,
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: './test/tsconfig.json',
			isolatedModules: true,
		}],
	},
};
