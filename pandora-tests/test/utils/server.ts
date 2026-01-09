import { test } from '@playwright/test';
import { fork, spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { PNPM_EXECUTABLE, TEST_ASSETS_DIR, TEST_COVERAGE_TEMP, TEST_DIRECTORY_PORT, TEST_LISTENER_HTTP_SERVER_PORT, TEST_PROJECT_PANDORA_DIR, TEST_SERVER_DIRECTORY_ENTRYPOINT, TEST_SERVER_DIRECTORY_TEST_DIR, TEST_SERVER_SHARD_ENTRYPOINT, TEST_SERVER_SHARD_SECRET, TEST_SERVER_SHARD_TEST_DIR, TEST_SHARD_PORT, TEST_TEMP } from '../_setup/config.ts';
import { Assert, EnvStringify } from './utils.ts';

import type { ENV as DIRECTORY_ENV } from 'pandora-server-directory/src/config.ts';
import type { ENV as SHARD_ENV } from 'pandora-server-shard/src/config.ts';

const DEBUG_DIRECT_PRINT = false;

export type DirectoryEnvSetup = Partial<typeof DIRECTORY_ENV>;
const DIRECTORY_ENV_DEFAULTS: DirectoryEnvSetup = {
	SERVER_PORT: TEST_DIRECTORY_PORT,
	SERVER_HTTPS_CERT: '',
	SERVER_HTTPS_KEY: '',
	SHARD_SHARED_SECRET: TEST_SERVER_SHARD_SECRET,
	TRUSTED_REVERSE_PROXY_HOPS: 0,
	LOG_DIR: path.resolve(TEST_SERVER_DIRECTORY_TEST_DIR, './logs'),
	LOG_PRODUCTION: false,
	LOG_DISCORD_WEBHOOK_URL: '',
	EMAIL_SENDER_TYPE: 'webhook',
	EMAIL_WEBHOOK_URL: `http://localhost:${TEST_LISTENER_HTTP_SERVER_PORT}/email/send_email`,
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
	configOverrides: Partial<DirectoryEnvSetup>;
}

export type ShardEnvSetup = Partial<typeof SHARD_ENV>;
const SHARD_ENV_DEFAULTS: ShardEnvSetup = {
	// Intentionally not set, because it breaks.
	// SHARD_DEVELOPMENT_MODE: false,

	//Networking
	SERVER_PORT: TEST_SHARD_PORT,
	SERVER_HTTPS_CERT: '',
	SERVER_HTTPS_KEY: '',
	SERVER_PUBLIC_ADDRESS: `http://127.0.0.1:${TEST_SHARD_PORT}`,
	TRUSTED_REVERSE_PROXY_HOPS: 0,
	SHARD_SHARED_SECRET: TEST_SERVER_SHARD_SECRET,
	DIRECTORY_ADDRESS: `http://127.0.0.1:${TEST_DIRECTORY_PORT}`,

	//Logging
	LOG_DIR: path.resolve(TEST_SERVER_SHARD_TEST_DIR, './logs'),
	LOG_PRODUCTION: false,
	LOG_DISCORD_WEBHOOK_URL: '',

	//Database
	DATABASE_TYPE: 'directory',
	DATABASE_URL: 'mongodb://localhost:27017',
	DATABASE_NAME: 'pandora-e2e-test',

	//Assets
	ASSETS_DEFINITION_PATH: TEST_ASSETS_DIR,
	ASSETS_SOURCE: '',
};

export interface TestStartShardOptions {
	/** Whether to keep the server active across tests */
	keepActive: boolean;
	configOverrides: Partial<ShardEnvSetup>;
}

interface ServerInstanceOptions {
	entrypoint: string;
	args?: string[];
	env: NodeJS.ProcessEnv;
	keepActive: boolean;
}

class ServerInstance {
	public readonly keepActive: boolean;

	public get exited(): boolean {
		return this._exited;
	}

	private readonly process: ChildProcess;
	private stdout: string = '';
	private stderr: string = '';
	private _exited: boolean = false;

	constructor(options: ServerInstanceOptions) {
		this.keepActive = options.keepActive;

		// On Windows we need IPC capabilities, so use fork
		// Using this we loose on nyc (coverage collection), but there is no way around this
		if (process.platform === 'win32') {
			this.process = fork(options.entrypoint, {
				cwd: TEST_PROJECT_PANDORA_DIR,
				env: options.env,
				stdio: DEBUG_DIRECT_PRINT ? 'inherit' : 'pipe',
			});
		} else {
			this.process = spawn(PNPM_EXECUTABLE, [
				'exec',
				'nyc',
				'--silent',
				'--no-clean', // Clean is handled by global setup
				'--cwd', TEST_PROJECT_PANDORA_DIR, // This is "working directory" only for istanbul, not for rest of command
				'--temp-dir', TEST_COVERAGE_TEMP, // This needs to be an absolute path
				'node',
				'--enable-source-maps',
				options.entrypoint,
				...(options.args ?? []),
			], {
				cwd: TEST_TEMP,
				env: options.env,
				stdio: DEBUG_DIRECT_PRINT ? 'inherit' : 'pipe',
			});
		}

		this.process.stdout?.on('data', (data: string | Buffer) => {
			this.stdout += data.toString();
		});
		this.process.stderr?.on('data', (data: string | Buffer) => {
			this.stderr += data.toString();
		});

		Servers.push(this);

		this.process.on('exit', this._handlePrematureExit);
	}

	public stop(): Promise<void> {
		Assert(!this.exited);

		return new Promise((resolve) => {
			this.process.on('exit', () => {
				this._onExit();
				resolve();
			});
			this.process.off('exit', this._handlePrematureExit);
			// On Windows soft-kill doesn't really work; we need to use IPC
			if (process.platform === 'win32') {
				this.process.send('STOP');
			} else {
				this.process.kill('SIGINT');
			}
		});
	}

	private readonly _handlePrematureExit = (code: number | null, signal: NodeJS.Signals | null) => {
		this._onExit();

		// eslint-disable-next-line no-console
		console.error(
			'\n========== Server exited unexpectedly (likely crash) ==========',
			'\nCode:', code,
			'\nSignal:', signal,
			'\n===== stdout =====\n',
			this.stdout,
			'\n\n===== stderr =====\n',
			this.stderr,
			'\n========== End of crash ==========\n',
		);
		throw new Error('Server exited unexpectedly');
	};

	private _onExit() {
		Assert(!this._exited);
		this._exited = true;

		const index = Servers.indexOf(this);
		Assert(index >= 0);
		Servers.splice(index, 1);
	}
}

const Servers: ServerInstance[] = [];

export function InternalSetupTestingEnvServers(): void {
	test.afterEach(async () => {
		for (let i = Servers.length - 1; i >= 0; i--) {
			const server = Servers[i];

			if (!server.keepActive) {
				await server.stop();
				Assert(!Servers.includes(server));
			}
		}
	});

	test.afterAll(async () => {
		for (let i = Servers.length - 1; i >= 0; i--) {
			const server = Servers[i];

			await server.stop();
			Assert(!Servers.includes(server));
		}
		Assert(Servers.length === 0);
	});
}

export function TestStartDirectory(options: Partial<TestStartDirectoryOptions> = {}): Promise<ServerInstance> {
	return Promise.resolve(new ServerInstance({
		entrypoint: TEST_SERVER_DIRECTORY_ENTRYPOINT,
		env: EnvStringify({
			...process.env,
			...DIRECTORY_ENV_DEFAULTS,
			...options.configOverrides,
		}),
		keepActive: options.keepActive === true,
	}));
}

export function TestStartShard(options: Partial<TestStartShardOptions> = {}): Promise<ServerInstance> {
	return Promise.resolve(new ServerInstance({
		entrypoint: TEST_SERVER_SHARD_ENTRYPOINT,
		env: EnvStringify({
			...process.env,
			...SHARD_ENV_DEFAULTS,
			...options.configOverrides,
		}),
		keepActive: options.keepActive === true,
	}));
}
