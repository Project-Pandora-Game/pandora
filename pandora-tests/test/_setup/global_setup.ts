/* eslint-disable no-console */
import { test as setup } from '@playwright/test';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import * as fs from 'fs';
import type { EnvInputJson } from 'pandora-common';
import { resolve } from 'path';
import * as tar from 'tar';
import type { WEBPACK_CONFIG } from '../../../pandora-client-web/src/config/definition.ts';
import {
	PNPM_EXECUTABLE,
	TEST_ASSETS_DIR,
	TEST_CLIENT_DIRECTORY_ADDRESS,
	TEST_CLIENT_DIST_DIR,
	TEST_CLIENT_EDITOR_ASSETS_ADDRESS,
	TEST_COVERAGE_TEMP,
	TEST_HTTP_SERVER_PORT,
	TEST_PROJECT_ASSETS_DIR,
	TEST_SERVER_DIRECTORY_TEST_DIR,
	TEST_SERVER_SHARD_TEST_DIR,
	TEST_TEMP,
} from './config.ts';

function Run(command: string, args: string[] = [], options: SpawnSyncOptions = {}): void {
	const { status, error } = spawnSync(command, args, {
		stdio: 'inherit',
		shell: true,
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
			fs.rmSync(TEST_TEMP, { recursive: true });
		}
		fs.mkdirSync(TEST_TEMP);
		fs.mkdirSync(TEST_SERVER_DIRECTORY_TEST_DIR);
		fs.mkdirSync(TEST_SERVER_SHARD_TEST_DIR);
	}

	// Build everything necessary
	if (shouldBuild) {
		console.log('\nBuilding servers...');
		Run(PNPM_EXECUTABLE, ['run', '-r', '--no-bail', '--filter', 'pandora-server-*', 'build']);

		console.log('\nBuilding client...');
		fs.mkdirSync(TEST_CLIENT_DIST_DIR);
		Run(PNPM_EXECUTABLE, ['run', '-r', '--no-bail', '--filter', 'pandora-client-web', 'build'], {
			env: {
				...process.env,
				DIST_DIR_OVERRIDE: TEST_CLIENT_DIST_DIR,
				DIRECTORY_ADDRESS: TEST_CLIENT_DIRECTORY_ADDRESS,
				EDITOR_ASSETS_ADDRESS: TEST_CLIENT_EDITOR_ASSETS_ADDRESS,
				EDITOR_ASSETS_OFFICIAL_ADDRESS: TEST_CLIENT_EDITOR_ASSETS_ADDRESS,
				EXTRA_ASSETS_ADDRESS: '',
				WEBPACK_DEV_SERVER_PORT: TEST_HTTP_SERVER_PORT.toString(10),
				WEBPACK_DEV_SERVER_SECURE: 'false',
				USER_DEBUG: 'false',
			} satisfies EnvInputJson<typeof WEBPACK_CONFIG>,
		});
	}

	// Prepare assets
	{
		console.log('\nPreparing assets...');
		if (fs.existsSync(TEST_ASSETS_DIR)) {
			fs.rmSync(TEST_ASSETS_DIR, { recursive: true });
		}
		fs.mkdirSync(TEST_ASSETS_DIR);

		// Get the archive
		const TEMP_ARCHIVE_PATH = resolve(TEST_TEMP, './assets.tar');
		const ASSETS_PROJECT_ARCHIVE_PATH = resolve(TEST_PROJECT_ASSETS_DIR, './out-for-test.tar');
		if (fs.existsSync(ASSETS_PROJECT_ARCHIVE_PATH) && fs.statSync(ASSETS_PROJECT_ARCHIVE_PATH).isFile()) {
			console.log('  Using test archive from local pandora-assets project');
			fs.copyFileSync(ASSETS_PROJECT_ARCHIVE_PATH, TEMP_ARCHIVE_PATH);
		} else {
			// TODO
			throw new Error('Fetching test archive is not yet supported');
		}

		// Extract the archive
		tar.extract({
			file: TEMP_ARCHIVE_PATH,
			sync: true,
			strict: true,
			cwd: TEST_ASSETS_DIR,
			preserveOwner: false,
		});
	}

	// Clean coverage temporary directory
	if (fs.existsSync(TEST_COVERAGE_TEMP)) {
		fs.rmSync(TEST_COVERAGE_TEMP, { recursive: true });
	}
	fs.mkdirSync(TEST_COVERAGE_TEMP);

	console.log('\n--- Global setup done ---\n');
});
