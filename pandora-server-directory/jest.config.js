/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
	clearMocks: true,
	collectCoverageFrom: [
		'src/**/*.ts',
		'src/**/*.tsx',
		'!src/index.ts',
	],
	coverageDirectory: 'coverage',
	errorOnDeprecated: true,
	watchPathIgnorePatterns: ['globalConfig'],
	transform: {
		'^.+\\.(t|j)sx?$': ['@swc/jest'],
	},
};
