import { IsObject } from 'pandora-common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PACKAGE_JSON = require('../package.json') as unknown;
if (!IsObject(PACKAGE_JSON) || typeof PACKAGE_JSON.version !== 'string') {
	throw new Error('Failed to read package.json');
}

export const APP_NAME = process.env.APP_NAME ?? 'Pandora Shard Server';
export const APP_VERSION: string = PACKAGE_JSON.version;

//#region Networking
/** Port on which will HTTP server listen */
export const SERVER_PORT = process.env.SERVER_PORT ?? '25561';
/** Path to HTTPS certificate file */
export const SERVER_HTTPS_CERT = process.env.SERVER_HTTPS_CERT ?? '';
/** Path to HTTPS key file */
export const SERVER_HTTPS_KEY = process.env.SERVER_HTTPS_KEY ?? '';
/** Public URL for shard */
export const SERVER_PUBLIC_ADDRESS = process.env.SERVER_PUBLIC_ADDRESS ?? '';
/** Secret key used to authenticate Shards connecting to Directory */
export const SHARD_SHARED_SECRET = process.env.SHARD_SHARED_SECRET ?? '';
/** URL-style address of Directory for Shard to connect to */
export const DIRECTORY_ADDRESS = process.env.DIRECTORY_ADDRESS ?? '';
//#endregion

//#region Database

/** Database type, possible values: directory, mongodb */
export const DATABASE_TYPE = process.env.DATABASE_TYPE ?? 'directory';
/** MongoDB connection string */
export const DATABASE_URL = process.env.DATABASE_URL ?? 'mongodb://localhost:27017';
/** Name of the db to connect to */
export const DATABASE_NAME = process.env.DATABASE_NAME ?? 'pandora-test';

//#endregion
