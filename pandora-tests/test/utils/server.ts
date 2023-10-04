import { Assert, AssertNotNullable } from './utils';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { TEST_DIRECTORY_PORT, TEST_SERVER_DIRECTORY_ENTRYPOINT, TEST_SERVER_DIRECTORY_TEST_DIR, TEST_TEMP } from '../_setup/config';
import { test } from '@playwright/test';
import path from 'path';

import type { ENV } from 'pandora-server-directory/src/config';
import { EnvStringify } from 'pandora-common/dist/environment';

export type DirectoryEnvSetup = Partial<typeof ENV>;

const DIRECTORY_ENV_DEFAULTS: DirectoryEnvSetup = {
	SERVER_PORT: TEST_DIRECTORY_PORT,
	SERVER_HTTPS_CERT: '',
	SERVER_HTTPS_KEY: '',
	SHARD_SHARED_SECRET: '',
	TRUSTED_REVERSE_PROXY_HOPS: 0,
	LOG_DIR: path.resolve(TEST_SERVER_DIRECTORY_TEST_DIR, './logs'),
	LOG_PRODUCTION: false,
	LOG_DISCORD_WEBHOOK_URL: '',
	EMAIL_SENDER_TYPE: 'mock',
	EMAIL_SMTP_CONFIG: '',
	EMAIL_SMTP_PASSWORD: '',
	DATABASE_TYPE: 'mock',
	DATABASE_URL: 'mongodb://localhost:27017',
	DATABASE_NAME: 'pandora-e2e-test',
	BETA_KEY_GLOBAL: '',
	BETA_KEY_ENABLED: false,
	AUTO_ADMIN_ACCOUNTS: [],
	DISCORD_BOT_TOKEN: '',
	DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID: '',
	DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID: '',
	HCAPTCHA_SECRET_KEY: '',
	HCAPTCHA_SITE_KEY: '',
};

export interface TestStartDirectoryOptions {
	/** Whether to keep the server active across tests */
	keepActive: boolean;
	configOverrides: DirectoryEnvSetup;
}

let DirectoryServer: {
	process: ChildProcessWithoutNullStreams;
	keepActive: boolean;
} | null = null;

export function TestStopDirectory(): Promise<void> {
	AssertNotNullable(DirectoryServer);
	const server = DirectoryServer;

	return new Promise((resolve) => {
		server.process.on('exit', () => {
			Assert(DirectoryServer === server);
			DirectoryServer = null;
			resolve();
		});
		server.process.kill('SIGINT');
	});
}

test.afterEach(async () => {
	if (DirectoryServer != null && !DirectoryServer.keepActive) {
		await TestStopDirectory();
	}
});

test.afterAll(async () => {
	if (DirectoryServer != null) {
		await TestStopDirectory();
	}
});

export function TestStartDirectory(options: Partial<TestStartDirectoryOptions> = {}): Promise<void> {
	Assert(DirectoryServer == null);

	const directoryProcess = spawn('node', ['--enable-source-maps', TEST_SERVER_DIRECTORY_ENTRYPOINT], {
		cwd: TEST_TEMP,
		env: EnvStringify({
			...process.env,
			...DIRECTORY_ENV_DEFAULTS,
			...options.configOverrides,
		}),
	});

	DirectoryServer = {
		process: directoryProcess,
		keepActive: options.keepActive === true,
	};

	return Promise.resolve();
}
