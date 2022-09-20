/* eslint-disable */
import '@testing-library/jest-dom';
import { logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';
// @ts-expect-error - Use Node's crypto module to polyfill crypto
import { webcrypto } from 'crypto';
// @ts-expect-error - Use Node's TextEncode & TextDecoder as polyfills for JSDom
import { TextEncoder, TextDecoder } from 'util';
import { TEST_DIRECTORY_ADDRESS } from './testEnv';

const { getRandomValues, subtle } = webcrypto;

globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;
// @ts-expect-error - use Node Buffer
globalThis.btoa ??= (str) => Buffer.from(str).toString('base64');
// @ts-expect-error - use Node Buffer
globalThis.atob ??= (str) => Buffer.from(str, 'base64').toString('utf8');

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
