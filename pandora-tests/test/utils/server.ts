import { Assert, AssertNotNullable } from './utils';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { TEST_DIRECTORY_PORT, TEST_SERVER_DIRECTORY_ENTRYPOINT, TEST_SERVER_DIRECTORY_TEST_DIR, TEST_TEMP } from '../_setup/config';
import { test } from '@playwright/test';
import path from 'path';

/* eslint-disable @typescript-eslint/naming-convention */
interface DirectoryEnvSetup {
	/** Port on which will HTTP server listen */
	SERVER_PORT: string;
	/** Path to HTTPS certificate file */
	SERVER_HTTPS_CERT: string;
	/** Path to HTTPS key file */
	SERVER_HTTPS_KEY: string;
	/** Secret key used to authenticate Shards connecting to Directory */
	SHARD_SHARED_SECRET: string;
	/** How many hops are we after a trusted reverse proxy */
	TRUSTED_REVERSE_PROXY_HOPS: string;

	/** The directory to store logs into */
	LOG_DIR: string;
	/** If the logging should use "production" preset, reducing verbosity and rotating logs */
	LOG_PRODUCTION: string;
	/** A webhook URL to log important events */
	LOG_DISCORD_WEBHOOK_URL: string;

	/** Email sender type, possible values: mock, smtp, ses */
	EMAIL_SENDER_TYPE: string;
	/** SMTP Email configuration, space separated list: service host user */
	EMAIL_SMTP_CONFIG: string;
	/** SMTP Email user password */
	EMAIL_SMTP_PASSWORD: string;

	/** Database type, possible values: mock, mongodb, mongodb-in-memory, mongodb-local */
	DATABASE_TYPE: string;
	/** MongoDB connection string */
	DATABASE_URL: string;
	/** Name of the db to connect to */
	DATABASE_NAME: string;

	/** Key needed to register, if set */
	BETA_KEY_GLOBAL: string;
	BETA_KEY_ENABLED: string;
	/** Comma separated list of accounts automatically granted 'admin' role. Does not affect database, only effective data */
	AUTO_ADMIN_ACCOUNTS: string;

	/** Discord bot token */
	DISCORD_BOT_TOKEN: string;
	/** Discord bot account status channel ID */
	DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID: string;
	/** Discord bot character status channel ID */
	DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID: string;

	/** hCaptcha secret key */
	HCAPTCHA_SECRET_KEY: string;
	/** hCaptcha site key */
	HCAPTCHA_SITE_KEY: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

const DIRECTORY_ENV_DEFAULTS: DirectoryEnvSetup = {
	SERVER_PORT: `${TEST_DIRECTORY_PORT}`,
	SERVER_HTTPS_CERT: '',
	SERVER_HTTPS_KEY: '',
	SHARD_SHARED_SECRET: '',
	TRUSTED_REVERSE_PROXY_HOPS: '0',
	LOG_DIR: path.resolve(TEST_SERVER_DIRECTORY_TEST_DIR, './logs'),
	LOG_PRODUCTION: '',
	LOG_DISCORD_WEBHOOK_URL: '',
	EMAIL_SENDER_TYPE: 'mock',
	EMAIL_SMTP_CONFIG: '',
	EMAIL_SMTP_PASSWORD: '',
	DATABASE_TYPE: 'mock',
	DATABASE_URL: 'mongodb://localhost:27017',
	DATABASE_NAME: 'pandora-e2e-test',
	BETA_KEY_GLOBAL: '',
	BETA_KEY_ENABLED: 'false',
	AUTO_ADMIN_ACCOUNTS: '',
	DISCORD_BOT_TOKEN: '',
	DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID: '',
	DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID: '',
	HCAPTCHA_SECRET_KEY: '',
	HCAPTCHA_SITE_KEY: '',
};

export interface TestStartDirectoryOptions {
	/** Whether to keep the server active across tests */
	keepActive: boolean;
	configOverrides: Partial<DirectoryEnvSetup>;
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
		env: {
			...process.env,
			...DIRECTORY_ENV_DEFAULTS,
			...options.configOverrides,
		},
	});

	DirectoryServer = {
		process: directoryProcess,
		keepActive: options.keepActive === true,
	};

	return Promise.resolve();
}
