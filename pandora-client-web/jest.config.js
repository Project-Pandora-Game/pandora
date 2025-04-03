// @ts-check
/* eslint-env node */
/**
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * @type { import('ts-jest').JestConfigWithTsJest }
 */
export default {
	clearMocks: true,
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
	coverageDirectory: 'coverage',
	coverageReporters: [
		'html',
		'json',
		'text-summary',
	],
	coverageProvider: 'v8',
	errorOnDeprecated: true,
	moduleNameMapper: {
		'\\.(png|jpe?g|gif|svg|eot|ttf|woff2?|mp3|wav)$': '<rootDir>/test/stubs/resourceStub.ts',
		'\\.s?css$': '<rootDir>/test/stubs/stylesheetStub.ts',
		'react-reverse-portal': '<rootDir>/node_modules/react-reverse-portal/dist/cjs/index.js',
	},
	resolver: '<rootDir>/test/resolver.cjs',
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: './test/tsconfig.json',
			useESM: true,
		}],
	},
};
