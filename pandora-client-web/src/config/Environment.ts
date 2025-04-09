import { CreateEnvParser } from 'pandora-common';
import { CLIENT_CONFIG } from './definition.ts';

export type NodeEnv = 'production' | 'development';

export const EnvParser = CreateEnvParser(CLIENT_CONFIG);
export const ENV = EnvParser();

export const GAME_NAME = ENV.GAME_NAME;
export const NODE_ENV = ENV.NODE_ENV;
export const DIRECTORY_ADDRESS = ENV.DIRECTORY_ADDRESS;
export const EDITOR_ASSETS_ADDRESS = ENV.EDITOR_ASSETS_ADDRESS;
export const EDITOR_ASSETS_OFFICIAL_ADDRESS = ENV.EDITOR_ASSETS_OFFICIAL_ADDRESS;
export const EXTRA_ASSETS_ADDRESS = ENV.EXTRA_ASSETS_ADDRESS;
export const DEVELOPMENT = NODE_ENV === 'development';
export const USER_DEBUG = DEVELOPMENT || ENV.USER_DEBUG;
export const GIT_COMMIT_HASH = ENV.GIT_COMMIT_HASH;
export const GIT_DESCRIBE = ENV.GIT_DESCRIBE;
export const BUILD_TIME = ENV.BUILD_TIME;

// Values that make sense to tweak globally, but not necessarily through Env

/** How often should an update be sent (at most) for things that update "live", such as movement, color picker, posing, ... */
export const LIVE_UPDATE_THROTTLE = 125; // ms
