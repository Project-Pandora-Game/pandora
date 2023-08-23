import * as path from 'path';

// Ports and addresses
export const TEST_HTTP_SERVER_PORT = 10269;
export const TEST_CLIENT_DIRECTORY_ADDRESS = 'http://127.0.0.1:25560';
export const TEST_CLIENT_EDITOR_ASSETS_ADDRESS = 'http://127.0.0.1:26969/assets';

// Paths
export const TEST_PROJECT_PANDORA_DIR = path.resolve(process.cwd(), '..');
export const TEST_CLIENT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-client-web');

export const TEST_TEMP = path.resolve(process.cwd(), './temp');
export const TEST_CLIENT_DIST_DIR = path.resolve(TEST_TEMP, './client_dist');
