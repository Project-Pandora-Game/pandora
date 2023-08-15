/* eslint-disable no-console */
import * as puppeteer from 'puppeteer';
import type { Config as JestConfig } from 'jest';
import express from 'express';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

import { TestContext, GetPuppeteerConfig, TEST_CLIENT_DIST_DIR, TEST_HTTP_SERVER_PORT, TEST_TEMP } from './config';

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
	console.log('\nRunning global setup');

	const ctx: TestContext = globalThis.__testContext = globalThis.__testContext ?? {};
	const cleanup: (() => Promise<void> | void)[] = ctx.cleanup = [];
	const puppeteerConfig = GetPuppeteerConfig();

	// Clean and setup temporary directory
	{
		if (fs.existsSync(TEST_TEMP)) {
			rimraf.sync(TEST_TEMP);
		}
		fs.mkdirSync(TEST_TEMP);
	}

	// Build everything necessary
	{
		console.log('Building common and servers...');
		Run('pnpm', ['run', '-r', '--no-bail', '--filter', '!pandora-client-web', 'build']);

		console.log('Building client...');
		fs.mkdirSync(TEST_CLIENT_DIST_DIR);
		Run('pnpm', ['run', '-r', '--no-bail', '--filter', 'pandora-client-web', 'build'], {
			env: {
				...process.env,
				DIST_DIR_OVERRIDE: TEST_CLIENT_DIST_DIR,
				DIRECTORY_ADDRESS: 'http://127.0.0.1:25560',
				EDITOR_ASSETS_ADDRESS: 'http://127.0.0.1:26969/assets',
				WEBPACK_DEV_SERVER_PORT: '6969',
				USER_DEBUG: 'false',
			},
		});
	}

	// Start HTTP server
	{
		console.log('Starting HTTP server...');
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
		console.log('Starting browser...');
		const browser = await puppeteer.launch(puppeteerConfig.launch);
		process.env.PUPPETEER_WS_ENDPOINT = browser.wsEndpoint();
		cleanup.push(async () => {
			await browser.close();
		});
	}

	console.log('\nGlobal setup done\n');
};
