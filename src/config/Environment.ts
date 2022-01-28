export type NodeEnv = 'production' | 'development';

export const GAME_NAME = process.env.GAME_NAME as string;
export const GAME_VERSION = process.env.VERSION as string;
export const NODE_ENV = process.env.NODE_ENV as NodeEnv;
export const DIRECTORY_ADDRESS = process.env.DIRECTORY_ADDRESS as string;
