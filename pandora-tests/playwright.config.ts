import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { TEST_CLIENT_DIST_DIR, TEST_HTTP_SERVER_PORT } from './test/_setup/config.ts';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './test',

	/* Fail CI if test.only was committed */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests */
	workers: 1,
	fullyParallel: false,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		['list'],
		['html', { open: 'never' }],
	],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		baseURL: `http://127.0.0.1:${TEST_HTTP_SERVER_PORT}`,

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
	},

	webServer: {
		command: `pnpm exec superstatic serve -p ${TEST_HTTP_SERVER_PORT} --host 127.0.0.1 "${path.relative(process.cwd(), TEST_CLIENT_DIST_DIR)}"`,
		port: TEST_HTTP_SERVER_PORT,
		reuseExistingServer: false,
	},

	projects: [
		{
			name: 'setup',
			testMatch: /global_setup\.ts/,
			timeout: 300_000,
			retries: 0,
		},

		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},

		// {
		//  name: 'firefox',
		//  use: { ...devices['Desktop Firefox'] },
		// },

		// {
		//  name: 'webkit',
		//  use: { ...devices['Desktop Safari'] },
		// },

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],
});
