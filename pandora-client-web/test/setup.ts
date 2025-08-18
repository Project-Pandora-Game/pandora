/// <reference types="@types/node" />
/// <reference types="@types/jest" />
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { webcrypto } from 'crypto';
import { Assert, logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';
import { TextDecoder, TextEncoder } from 'util';
import { TEST_DIRECTORY_ADDRESS } from './testEnv.ts';

Assert(typeof globalThis.TextEncoder === 'undefined');
// @ts-expect-error - Polyfill TextDecoder as JSDom doesn't support it
globalThis.TextEncoder = TextEncoder;

Assert(typeof globalThis.TextDecoder === 'undefined');
// @ts-expect-error - Polyfill TextDecoder as JSDom doesn't support it
globalThis.TextDecoder = TextDecoder;

Assert(typeof globalThis.crypto.subtle === 'undefined');
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

Assert(typeof globalThis.Worker === 'undefined');
// @ts-expect-error - Polyfill Worker as JSDom doesn't support it
globalThis.Worker = class Worker {
	constructor() {
		throw new Error('Not implemented');
	}
};

// Polyfill ResizeObserver as JSDom doesn't support it
Assert(typeof globalThis.ResizeObserver === 'undefined');
globalThis.ResizeObserver = jest.fn<() => ResizeObserver>().mockImplementation(() => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
}));

// Polyfill matchMedia as JSDom doesn't support it
Assert(typeof globalThis.matchMedia === 'undefined');
Object.defineProperty(globalThis, 'matchMedia', {
	writable: true,
	value: jest.fn<typeof globalThis.matchMedia>().mockImplementation((query: string): ReturnType<typeof globalThis.matchMedia> => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn<() => boolean>().mockReturnValue(true),
	})),
});

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	throw new Error('Fatal error happened');
});
