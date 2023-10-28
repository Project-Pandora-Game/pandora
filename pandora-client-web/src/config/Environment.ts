import { CreateEnvParser } from 'pandora-common';
import { CLIENT_CONFIG } from './definition';

export type NodeEnv = 'production' | 'development';

export const EnvParser = CreateEnvParser(CLIENT_CONFIG);
export const ENV = EnvParser();

export const GAME_NAME = ENV.GAME_NAME;
export const GAME_VERSION = ENV.GAME_VERSION;
export const NODE_ENV = ENV.NODE_ENV;
export const DIRECTORY_ADDRESS = ENV.DIRECTORY_ADDRESS;
export const EDITOR_ASSETS_ADDRESS = ENV.EDITOR_ASSETS_ADDRESS;
export const EXTRA_ASSETS_ADDRESS = ENV.EXTRA_ASSETS_ADDRESS;
export const USER_DEBUG = NODE_ENV !== 'production' || ENV.USER_DEBUG;
export const GIT_COMMIT_HASH = ENV.GIT_COMMIT_HASH;
export const GIT_DESCRIBE = ENV.GIT_DESCRIBE;
