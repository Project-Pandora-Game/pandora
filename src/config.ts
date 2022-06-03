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

//#region Expiration settings

/** Time (in ms) for how long is a account login token valid */
export const LOGIN_TOKEN_EXPIRATION = 24 * 60 * 60_000;
/** Time (in ms) for how long is a account activation token valid */
export const ACTIVATION_TOKEN_EXPIRATION = 7 * 24 * 60 * 60_000;
/** Time (in ms) for how long is a password reset token valid */
export const PASSWORD_RESET_TOKEN_EXPIRATION = 24 * 60 * 60_000;

//#endregion

//#region Email settings

/** Static hash salt */
export const EMAIL_SALT = 'pandora-directory-server:';
/** Email sender type, possible values: mock, smtp */
export const EMAIL_SENDER_TYPE = process.env.EMAIL_SENDER_TYPE ?? 'mock';
/** SMTP Email configuration, space separated list: service host user */
export const EMAIL_SMTP_CONFIG = process.env.EMAIL_SMTP_CONFIG ?? '';
/** SMTP Email user password */
export const EMAIL_SMTP_PASSWORD = process.env.EMAIL_SMTP_PASSWORD ?? '';

//#endregion

//#region Database

/** Database type, possible values: mock, mongodb, mongodb-in-memory, mongodb-local */
export const DATABASE_TYPE = process.env.DATABASE_TYPE ?? 'mock';
/** MongoDB connection string */
export const DATABASE_URL = process.env.DATABASE_URL ?? 'mongodb://localhost:27017';
/** Name of the db to connect to */
export const DATABASE_NAME = process.env.DATABASE_NAME ?? 'pandora-test';

//#endregion

//#region Character

/** Character limit for normal account */
export const CHARACTER_LIMIT_NORMAL = 5;

//#endregion

//#region Development

/** Key needed to register, if set */
export const BETA_KEY = process.env.BETA_KEY ?? '';

//#endregion
