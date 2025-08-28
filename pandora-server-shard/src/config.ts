import { CreateEnvParser, IsObject } from 'pandora-common';
import * as z from 'zod';
import PACKAGE_JSON from '../package.json' with { type: 'json' };

if (!IsObject(PACKAGE_JSON) || typeof PACKAGE_JSON.version !== 'string') {
	throw new Error('Failed to read package.json');
}

export const APP_VERSION: string = PACKAGE_JSON.version;

export const EnvParser = CreateEnvParser({

	/** The name of the application */
	APP_NAME: z.string().default('Pandora Shard Server'),

	/** If this shard is in development mode */
	SHARD_DEVELOPMENT_MODE: z.boolean().transform((arg) => arg || process.argv.includes('--development')).default(false),

	//#region Networking
	/** Port on which will HTTP server listen */
	SERVER_PORT: z.number().int().default(25561),
	/** Path to HTTPS certificate file */
	SERVER_HTTPS_CERT: z.string().default(''),
	/** Path to HTTPS key file */
	SERVER_HTTPS_KEY: z.string().default(''),
	/** Public URL for shard */
	SERVER_PUBLIC_ADDRESS: z.string().default('http://127.0.0.1:25561'),
	/** How many hops are we after a trusted reverse proxy */
	TRUSTED_REVERSE_PROXY_HOPS: z.number().default(0),
	/** Secret key used to authenticate Shards connecting to Directory */
	SHARD_SHARED_SECRET: z.string().default('pandora-shard-secret'),
	/** URL-style address of Directory for Shard to connect to */
	DIRECTORY_ADDRESS: z.string().default('http://127.0.0.1:25560'),
	//#endregion

	//#region Logging
	/** The directory to store logs into */
	LOG_DIR: z.string().default('./logs'),
	/** If the logging should use "production" preset, reducing verbosity and rotating logs */
	LOG_PRODUCTION: z.boolean().default(false),
	/** A webhook URL to log important events */
	LOG_DISCORD_WEBHOOK_URL: z.string().default(''),
	//#endregion

	//#region Database
	/** Database type, possible values: directory, mongodb */
	DATABASE_TYPE: z.enum(['directory', 'mongodb']).default('directory'),
	/** MongoDB connection string */
	DATABASE_URL: z.string().default('mongodb://localhost:27017'),
	/** Name of the db to connect to */
	DATABASE_NAME: z.string().default('pandora-test'),
	//#endregion

	//#region Assets
	/** Path to directory that has compiled asset definitions */
	ASSETS_DEFINITION_PATH: z.string().default('../../pandora-assets/out'),
	/** URL from where Client will download assets; empty to host on this shard */
	ASSETS_SOURCE: z.string().default(''),
	//#endregion
});

export const ENV = EnvParser();
