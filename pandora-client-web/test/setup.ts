/* eslint-disable */
import '@testing-library/jest-dom';
import { Assert, logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import { TEST_DIRECTORY_ADDRESS } from './testEnv';

Assert(typeof globalThis.TextEncoder === "undefined");
globalThis.TextEncoder = TextEncoder;

Assert(typeof globalThis.TextDecoder === "undefined");
// @ts-expect-error - Polyfill TextDecoder as JSDom doesn't support it
globalThis.TextDecoder = TextDecoder;

Assert(typeof globalThis.crypto.subtle === "undefined");
// @ts-expect-error - Polyfill subtle crypto as JSDom doesn't support it
globalThis.crypto.subtle = webcrypto.subtle;

// @ts-expect-error - Normally added by Webpack
globalThis.process = {
	env: {
		GAME_NAME: 'Pandora',
		VERSION: '0.0.0',
		NODE_ENV: 'test',
		DIRECTORY_ADDRESS: TEST_DIRECTORY_ADDRESS,
	},
};

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	throw new Error('Fatal error happened');
});
