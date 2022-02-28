/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
	clearMocks: true,
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
	coverageDirectory: 'coverage',
	coverageProvider: 'babel',
	errorOnDeprecated: true,
	preset: '@shelf/jest-mongodb',
	watchPathIgnorePatterns: ['globalConfig'],
};
