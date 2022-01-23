/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
	bail: 50,
	clearMocks: true,
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
	coverageDirectory: 'coverage',
	coverageProvider: 'babel',
	errorOnDeprecated: true,
	moduleDirectories: ['node_modules', 'src'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
