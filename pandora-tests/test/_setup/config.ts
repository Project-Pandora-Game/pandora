import * as path from 'path';

export const PNPM_EXECUTABLE = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

// Test assets
/** URL for test assets download. Replace `%v` with expected sha256 base64url hash of the uncompressed archive file. */
export const TEST_ASSETS_DOWNLOAD_URL = 'https://project-pandora.com/pandora-extra-assets/testing/test-assets-%v.tar.zst';

// Ports and addresses
export const TEST_DIRECTORY_PORT = 25560;
export const TEST_SHARD_PORT = 25570;
export const TEST_HTTP_SERVER_PORT = 10269; // HTTP server for client
export const TEST_LISTENER_HTTP_SERVER_PORT = 10369; // HTTP server from testing process, for listening to webhook events
export const TEST_CLIENT_DIRECTORY_ADDRESS = `http://127.0.0.1:${TEST_DIRECTORY_PORT}`;
export const TEST_CLIENT_EDITOR_ASSETS_ADDRESS = 'http://127.0.0.1:26969/assets';

// Paths
export const TEST_PROJECT_PANDORA_DIR = path.resolve(process.cwd(), '..');
export const TEST_CLIENT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-client-web');
export const TEST_PROJECT_ASSETS_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, '../pandora-assets');

export const TEST_TEMP = path.resolve(process.cwd(), './temp');
export const TEST_CLIENT_DIST_DIR = path.resolve(TEST_TEMP, './client_dist');
export const TEST_ASSETS_DIR = path.resolve(TEST_TEMP, './assets');

export const TEST_SERVER_DIRECTORY_PROJECT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-server-directory');
export const TEST_SERVER_DIRECTORY_ENTRYPOINT = path.resolve(TEST_SERVER_DIRECTORY_PROJECT_DIR, './dist/index.js');
export const TEST_SERVER_DIRECTORY_TEST_DIR = path.resolve(TEST_TEMP, './server_directory');

export const TEST_SERVER_SHARD_PROJECT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-server-shard');
export const TEST_SERVER_SHARD_ENTRYPOINT = path.resolve(TEST_SERVER_SHARD_PROJECT_DIR, './dist/index.js');
export const TEST_SERVER_SHARD_TEST_DIR = path.resolve(TEST_TEMP, './server_shard');

export const TEST_SERVER_SHARD_SECRET = 'test-shard-test-secret';

export const TEST_COVERAGE_TEMP = path.resolve(TEST_TEMP, './nyc_coverage');
