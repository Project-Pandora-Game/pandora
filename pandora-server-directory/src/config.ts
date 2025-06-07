import { CreateEnvParser, EnvTimeInterval } from 'pandora-common';
import { z } from 'zod';

export const EnvParser = CreateEnvParser({

	APP_NAME: z.string().default('Pandora Directory Server'),

	//#region Networking

	/** Port on which will HTTP server listen */
	SERVER_PORT: z.number().int().default(25560),
	/** Path to HTTPS certificate file */
	SERVER_HTTPS_CERT: z.string().default(''),
	/** Path to HTTPS key file */
	SERVER_HTTPS_KEY: z.string().default(''),
	/** Secret key used to authenticate Shards connecting to Directory */
	SHARD_SHARED_SECRET: z.string().default(''),
	/** Secret key used to authenticate against management endpoints */
	ADMIN_ENDPOINT_TOKEN: z.string().default(''),
	/** How many hops are we after a trusted reverse proxy */
	TRUSTED_REVERSE_PROXY_HOPS: z.number().default(0),

	//#endregion

	//#region Logging
	/** The directory to store logs into */
	LOG_DIR: z.string().default('./logs'),
	/** If the logging should use "production" preset, reducing verbosity and rotating logs */
	LOG_PRODUCTION: z.boolean().default(false),
	/** A webhook URL to log important events */
	LOG_DISCORD_WEBHOOK_URL: z.string().default(''),

	//#endregion

	//#region Expiration settings

	/** Time (in ms) for how long is an account login token valid */
	LOGIN_TOKEN_EXPIRATION: EnvTimeInterval().default('1w'),
	/** Time (in ms) for how long is an account activation token valid */
	ACTIVATION_TOKEN_EXPIRATION: EnvTimeInterval().default('1w'),
	/** Time (in ms) for how long is a password reset token valid */
	PASSWORD_RESET_TOKEN_EXPIRATION: EnvTimeInterval().default('1d'),
	/** Time (in ms) for rate limiting email change for not activated accounts */
	RATE_LIMIT_EMAIL_CHANGE_NOT_ACTIVATED: EnvTimeInterval().default('10m'),

	//#endregion

	//#region Email settings

	/** Static hash salt */
	EMAIL_SALT: z.string().default('pandora-directory-server:'),
	/** Email sender type, possible values: mock, smtp, ses */
	EMAIL_SENDER_TYPE: z.enum(['mock', 'smtp', 'ses']).default('mock'),
	/** SMTP Email configuration, space-separated list: service host user */
	EMAIL_SMTP_CONFIG: z.string().default(''),
	/** SMTP Email user password */
	EMAIL_SMTP_PASSWORD: z.string().default(''),

	//#endregion

	//#region Database

	/** Database type, possible values: mock, mongodb, mongodb-in-memory, mongodb-local */
	DATABASE_TYPE: z.enum(['mock', 'mongodb', 'mongodb-in-memory', 'mongodb-local']).default('mock'),
	/** MongoDB connection string */
	DATABASE_URL: z.string().default('mongodb://localhost:27017'),
	/** Name of the db to connect to */
	DATABASE_NAME: z.string().default('pandora-test'),
	/** Database migration strategy. Anything but `disable` is costly and should only be used when there is a need for migration. */
	DATABASE_MIGRATION: z.enum(['disable', 'dry-run', 'migrate']).default('disable'),

	//#endregion

	//#region Development

	/** Key needed to register, if set */
	BETA_KEY_GLOBAL: z.string().default(''),
	BETA_KEY_ENABLED: z.boolean().default(false),
	/** Comma separated list of accounts automatically granted 'admin' role. Does not affect database, only effective data */
	AUTO_ADMIN_ACCOUNTS: z.preprocess((ctx) => typeof ctx !== 'string' ? ctx : ctx
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean)
		.map((x) => parseInt(x, 10)), z.array(z.number())).default([]),

	//#endregion

	//#region Discord

	/** Discord bot token */
	DISCORD_BOT_TOKEN: z.string().default(''),
	/** Discord bot account status channel ID */
	DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID: z.string().default(''),
	/** Discord bot character status channel ID */
	DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID: z.string().default(''),

	// Beta registration roles
	DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID: z.string().default(''),
	DISCORD_BETA_ACCESS_ROLE_ID: z.string().default(''),

	//#endregion

	//#region Captcha

	/** hCaptcha secret key */
	HCAPTCHA_SECRET_KEY: z.string().default(''),
	/** hCaptcha site key */
	HCAPTCHA_SITE_KEY: z.string().default(''),

	//#endregion

	//#region Account Security

	/** Time window for login attempts */
	LOGIN_ATTEMPT_WINDOW: EnvTimeInterval().default('15m'),
	/** Max failed login attempts before requiring a captcha */
	LOGIN_ATTEMPT_LIMIT: z.number().int().positive().default(30),

	//#endregion
});

export const ENV = EnvParser();
