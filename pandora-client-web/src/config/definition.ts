import { z } from 'zod';

export const WEBPACK_BASE_CONFIG = {
	DIRECTORY_ADDRESS: z.string().default('http://127.0.0.1:25560'),
	EDITOR_ASSETS_ADDRESS: z.string().default('http://127.0.0.1:26969/assets'),
	USER_DEBUG: z.boolean().default(false),
} as const;

export const WEBPACK_CONFIG = {
	...WEBPACK_BASE_CONFIG,
	WEBPACK_DEV_SERVER_PORT: z.number().default(6969),
	DIST_DIR_OVERRIDE: z.string().optional(),
} as const;

export const CLIENT_CONFIG = {
	...WEBPACK_BASE_CONFIG,
	GAME_NAME: z.string(),
	GAME_VERSION: z.string(),
	NODE_ENV: z.enum(['production', 'development']),
	GIT_COMMIT_HASH: z.string(),
	GIT_DESCRIBE: z.string(),
} as const;
