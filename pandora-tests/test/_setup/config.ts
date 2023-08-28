import * as path from 'path';

// Ports and addresses
export const TEST_DIRECTORY_PORT = 25560;
export const TEST_HTTP_SERVER_PORT = 10269;
export const TEST_CLIENT_DIRECTORY_ADDRESS = `http://127.0.0.1:${TEST_DIRECTORY_PORT}`;
export const TEST_CLIENT_EDITOR_ASSETS_ADDRESS = 'http://127.0.0.1:26969/assets';

// Paths
export const TEST_PROJECT_PANDORA_DIR = path.resolve(process.cwd(), '..');
export const TEST_CLIENT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-client-web');

export const TEST_TEMP = path.resolve(process.cwd(), './temp');
export const TEST_CLIENT_DIST_DIR = path.resolve(TEST_TEMP, './client_dist');

export const TEST_SERVER_DIRECTORY_PROJECT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-server-directory');
export const TEST_SERVER_DIRECTORY_ENTRYPOINT = path.resolve(TEST_SERVER_DIRECTORY_PROJECT_DIR, './dist/index.js');
export const TEST_SERVER_DIRECTORY_TEST_DIR = path.resolve(TEST_TEMP, './server_directory');
