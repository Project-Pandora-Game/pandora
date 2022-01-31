export const APP_NAME = process.env.APP_NAME ?? 'Pandora Directory Server';

//#region Networking
/** Port on which will HTTP server listen */
export const SERVER_PORT = process.env.SERVER_PORT ?? '25560';
/** Path to HTTPS certificate file */
export const SERVER_HTTPS_CERT = process.env.SERVER_HTTPS_CERT ?? '';
/** Path to HTTPS key file */
export const SERVER_HTTPS_KEY = process.env.SERVER_HTTPS_KEY ?? '';
/** Secret key used to authenticate Shards connecting to Directory */
export const SHARD_SHARED_SECRET = process.env.SHARD_SHARED_SECRET ?? '';
//#endregion

/** Time (in ms) for how long is a account login token valid */
export const LOGIN_TOKEN_EXPIRATION = 24 * 60 * 60_000;
/** Time (in ms) for how long is a account activation token valid */
export const ACTIVATION_TOKEN_EXPIRATION = 7 * 24 * 60 * 60_000;
/** Time (in ms) for how long is a password reset token valid */
export const PASSWORD_RESET_TOKEN_EXPIRATION = 24 * 60 * 60_000;

/** Static hash salt */
export const EMAIL_SALT = 'pandora-directory-server:';
