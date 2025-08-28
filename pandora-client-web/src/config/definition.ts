import * as z from 'zod';

export const WEBPACK_BASE_CONFIG = {
	DIRECTORY_ADDRESS: z.string().default('http://127.0.0.1:25560'),
	EDITOR_ASSETS_ADDRESS: z.string().default('http://127.0.0.1:26969/assets'),
	EDITOR_ASSETS_OFFICIAL_ADDRESS: z.string().default('https://assets.project-pandora.com'),
	EXTRA_ASSETS_ADDRESS: z.string().default(''),
	USER_DEBUG: z.boolean().default(false),
} as const;

export const WEBPACK_CONFIG = {
	...WEBPACK_BASE_CONFIG,
	WEBPACK_DEV_SERVER_PORT: z.number().default(6969),
	WEBPACK_DEV_SERVER_SECURE: z.boolean().default(false),
	DIST_DIR_OVERRIDE: z.string().optional(),
} as const;

export const CLIENT_CONFIG = {
	...WEBPACK_BASE_CONFIG,
	GAME_NAME: z.string().optional(),
	NODE_ENV: z.enum(['production', 'development', 'test']),
	GIT_COMMIT_HASH: z.string().optional(),
	GIT_DESCRIBE: z.string().optional(),
	BUILD_TIME: z.number().default(0),
} as const;

/** Content of the version.json file used for for checking for new version availability */
export const VersionDataSchema = z.object({
	gitDescribe: z.string(),
	gitCommitHash: z.string(),
	buildTime: z.number(),
});
export type VersionData = z.infer<typeof VersionDataSchema>;
