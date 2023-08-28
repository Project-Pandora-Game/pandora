/* eslint-disable no-console */
import { test as setup } from '@playwright/test';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

import { TEST_CLIENT_DIST_DIR, TEST_HTTP_SERVER_PORT, TEST_TEMP, TEST_CLIENT_DIRECTORY_ADDRESS, TEST_CLIENT_EDITOR_ASSETS_ADDRESS, TEST_SERVER_DIRECTORY_TEST_DIR } from './config';

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

setup('Setup', () => {
	console.log('\n--- Running global setup ---\n');

	const shouldBuild = process.env.SKIP_TEST_BUILD !== 'true' || !fs.existsSync(TEST_TEMP);

	// Clean and setup temporary directory
	if (shouldBuild) {
		if (fs.existsSync(TEST_TEMP)) {
			rimraf.sync(TEST_TEMP);
		}
		fs.mkdirSync(TEST_TEMP);
		fs.mkdirSync(TEST_SERVER_DIRECTORY_TEST_DIR);
	}

	// Build everything necessary
	if (shouldBuild) {
		console.log('\nBuilding servers...');
		Run('pnpm', ['run', '-r', '--no-bail', '--filter', 'pandora-server-*', 'build']);

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

	console.log('\n--- Global setup done ---\n');
});
