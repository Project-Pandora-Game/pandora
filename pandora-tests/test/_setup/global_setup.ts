/* eslint-disable no-console */
import * as puppeteer from 'puppeteer';
import type { Config as JestConfig } from 'jest';
import express from 'express';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

import { TestContext, GetPuppeteerConfig, TEST_CLIENT_DIST_DIR, TEST_HTTP_SERVER_PORT, TEST_TEMP, TEST_CLIENT_DIRECTORY_ADDRESS, TEST_CLIENT_EDITOR_ASSETS_ADDRESS } from './config';

function Run(command: string, args: string[] = [], options: SpawnSyncOptions = {}): void {
	const { status, error } = spawnSync(command, args, {
		stdio: 'inherit',
		...options,
	});
	if (error)
		throw error;
	if (status !== 0) {
		throw new Error(`Child process terminated with non-zero code: ${status ?? 'null'}`);
	}
}

export default async (_jestConfig: JestConfig) => {
	console.log('\n--- Running global setup ---\n');

	const ctx: TestContext = globalThis.__testContext = globalThis.__testContext ?? {};
	const cleanup: (() => Promise<void> | void)[] = ctx.cleanup = [];
	const puppeteerConfig = GetPuppeteerConfig();

	const shouldBuild = process.env.SKIP_TEST_BUILD !== 'true' || !fs.existsSync(TEST_TEMP);

	// Clean and setup temporary directory
	if (shouldBuild) {
		if (fs.existsSync(TEST_TEMP)) {
			rimraf.sync(TEST_TEMP);
		}
		fs.mkdirSync(TEST_TEMP);
	}

	// Build everything necessary
	if (shouldBuild) {
		console.log('\nBuilding common and servers...');
		Run('pnpm', ['run', '-r', '--no-bail', '--filter', '!pandora-client-web', 'build']);

		console.log('\nBuilding client...');
		fs.mkdirSync(TEST_CLIENT_DIST_DIR);
		Run('pnpm', ['run', '-r', '--no-bail', '--filter', 'pandora-client-web', 'build'], {
			env: {
				...process.env,
				DIST_DIR_OVERRIDE: TEST_CLIENT_DIST_DIR,
				DIRECTORY_ADDRESS: TEST_CLIENT_DIRECTORY_ADDRESS,
				EDITOR_ASSETS_ADDRESS: TEST_CLIENT_EDITOR_ASSETS_ADDRESS,
				WEBPACK_DEV_SERVER_PORT: TEST_HTTP_SERVER_PORT.toString(10),
				USER_DEBUG: 'false',
			},
		});
	}

	// Start HTTP server
	{
		console.log('\nStarting HTTP server...');
		const app = express();

		app.use(
			'/',
			express.static(TEST_CLIENT_DIST_DIR),
		);

		const server = app.listen(TEST_HTTP_SERVER_PORT);

		cleanup.push(async () => {
			await new Promise((resolve) => {
				server.close(resolve);
				server.closeAllConnections();
			});
		});
	}

	// Start puppeteer
	{
		console.log('\nStarting browser...');
		const browser = await puppeteer.launch(puppeteerConfig.launch);
		process.env.PUPPETEER_WS_ENDPOINT = browser.wsEndpoint();
		cleanup.push(async () => {
			await browser.close();
		});
	}

	console.log('\n--- Global setup done ---\n');
};
