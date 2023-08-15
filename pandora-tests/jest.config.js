/**
 * @see https://jestjs.io/docs/configuration
 * @type { import('ts-jest').JestConfigWithTsJest }
 */
module.exports = {
	clearMocks: true,
	errorOnDeprecated: true,
	testTimeout: 60_000,
	globalSetup: '<rootDir>/test/_setup/global_setup.ts',
	globalTeardown: '<rootDir>/test/_setup/global_teardown.ts',
	testEnvironment: '<rootDir>/test/_setup/environment.ts',
	setupFilesAfterEnv: [
		'expect-puppeteer',
	],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: './test/tsconfig.json',
			isolatedModules: true,
		}],
	},
};
