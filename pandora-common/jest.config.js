/* eslint-env node */
/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
	clearMocks: true,
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
	coverageDirectory: 'coverage',
	errorOnDeprecated: true,
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	transform: {
		'^.+\\.(t|j)sx?$': ['@swc/jest'],
	},
};
