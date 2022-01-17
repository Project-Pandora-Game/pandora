export const APP_NAME = process.env.APP_NAME ?? 'Pandora Shard Server';

//#region Networking
/** Port on which will HTTP server listen */
export const SERVER_PORT = process.env.SERVER_PORT ?? '25561';
/** Path to HTTPS certificate file */
export const SERVER_HTTPS_CERT = process.env.SERVER_HTTPS_CERT ?? '';
/** Path to HTTPS key file */
export const SERVER_HTTPS_KEY = process.env.SERVER_HTTPS_KEY ?? '';
/** Secret key used to authenticate Shards connecting to Directory */
export const SHARD_SHARED_SECRET = process.env.SHARD_SHARED_SECRET ?? '';
/** URL-style address of Directory for Shard to connect to */
export const DIRECTORY_ADDRESS = process.env.DIRECTORY_ADDRESS ?? '';
//#endregion
