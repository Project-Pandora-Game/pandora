/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
	clearMocks: true,
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
	coverageDirectory: 'coverage',
	errorOnDeprecated: true,
	moduleNameMapper: {
		'\\.(png|jpe?g|gif|svg|eot|ttf|woff2?)$': '<rootDir>/test/stubs/resourceStub.ts',
		'\\.s?css$': '<rootDir>/test/stubs/stylesheetStub.ts',
	},
	resolver: '<rootDir>/test/resolver.js',
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	transform: {
		'^.+\\.(t|j)sx?$': ['@swc/jest'],
	},
};
