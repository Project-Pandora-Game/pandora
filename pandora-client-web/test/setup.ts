/* eslint-disable */
import '@testing-library/jest-dom';
import { logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import { TEST_DIRECTORY_ADDRESS } from './testEnv';

// @ts-expect-error - It works, not sure why types says it doesn't
const { getRandomValues, subtle } = webcrypto;

globalThis.TextEncoder ??= TextEncoder;
// @ts-expect-error - Polyfill TextDecoder as JSDom doesn't support it
globalThis.TextDecoder ??= TextDecoder;
globalThis.btoa ??= (str) => Buffer.from(str).toString('base64');
globalThis.atob ??= (str) => Buffer.from(str, 'base64').toString('utf8');

// @ts-expect-error - Polyfill crypto as JSDom doesn't support it
globalThis.crypto ??= webcrypto;
globalThis.crypto.getRandomValues ??= getRandomValues;
// @ts-expect-error - Polyfill SubtleCrypto as JSDom doesn't support it
globalThis.crypto.subtle ??= subtle;

// @ts-expect-error -
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
	fail('Fatal error happened');
});
