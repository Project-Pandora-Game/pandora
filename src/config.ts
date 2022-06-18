import { IsObject } from 'pandora-common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PACKAGE_JSON = require('../package.json') as unknown;
if (!IsObject(PACKAGE_JSON) || typeof PACKAGE_JSON.version !== 'string') {
	throw new Error('Failed to read package.json');
}

export const APP_NAME = process.env.APP_NAME ?? 'Pandora Shard Server';
export const APP_VERSION: string = PACKAGE_JSON.version;

/** If this shard is in development mode */
export const SHARD_DEVELOPMENT_MODE: boolean = process.argv.includes('--development') || !!process.env.SHARD_DEVELOPMENT_MODE;

//#region Networking
/** Port on which will HTTP server listen */
export const SERVER_PORT = process.env.SERVER_PORT ?? '25561';
/** Path to HTTPS certificate file */
export const SERVER_HTTPS_CERT = process.env.SERVER_HTTPS_CERT ?? '';
/** Path to HTTPS key file */
export const SERVER_HTTPS_KEY = process.env.SERVER_HTTPS_KEY ?? '';
/** Public URL for shard */
export const SERVER_PUBLIC_ADDRESS = process.env.SERVER_PUBLIC_ADDRESS ?? 'http://127.0.0.1:25561';
/** How many hops are we after a trusted reverse proxy */
export const TRUSTED_REVERSE_PROXY_HOPS = Number.parseInt(process.env.TRUSTED_REVERSE_PROXY_HOPS ?? '0') || 0;
/** Secret key used to authenticate Shards connecting to Directory */
export const SHARD_SHARED_SECRET = process.env.SHARD_SHARED_SECRET ?? 'pandora-shard-secret';
/** URL-style address of Directory for Shard to connect to */
export const DIRECTORY_ADDRESS = process.env.DIRECTORY_ADDRESS ?? 'http://127.0.0.1:25560';
//#endregion

//#region Logging

/** The directory to store logs into */
export const LOG_DIR = process.env.LOG_DIR ?? './logs';
/** If the logging should use "production" preset, reducing verbosity and rotating logs */
export const LOG_PRODUCTION = (process.env.LOG_PRODUCTION ?? '').toLocaleLowerCase() === 'true';
/** A webhook URL to log important events */
export const LOG_DISCORD_WEBHOOK_URL = process.env.LOG_DISCORD_WEBHOOK_URL ?? '';

//#endregion

//#region Database

/** Database type, possible values: directory, mongodb */
export const DATABASE_TYPE = process.env.DATABASE_TYPE ?? 'directory';
/** MongoDB connection string */
export const DATABASE_URL = process.env.DATABASE_URL ?? 'mongodb://localhost:27017';
/** Name of the db to connect to */
export const DATABASE_NAME = process.env.DATABASE_NAME ?? 'pandora-test';

//#endregion

//#region Assets

/** Path to directory that has compiled asset definitions */
export const ASSETS_DEFINITION_PATH = process.env.ASSETS_DEFINITION_PATH ?? '../pandora-assets/out';
/** URL from where Client will download assets; empty to host on this shard */
export const ASSETS_SOURCE = process.env.ASSETS_SOURCE ?? '';

//#endregion
