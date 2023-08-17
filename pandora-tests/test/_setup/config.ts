import type { BrowserContext, Browser, PuppeteerLaunchOptions } from 'puppeteer';
import * as path from 'path';

export type TestContext = {
	cleanup?: (() => Promise<void> | void)[];
};

declare global {
	// eslint-disable-next-line no-var, @typescript-eslint/naming-convention
	var __testContext: TestContext | undefined;
}

export type PuppeteerConfig = {
	browserContext: 'default' | 'incognito';
	runBeforeUnloadOnClose?: boolean;
	launch: PuppeteerLaunchOptions;
};

export type CoverageData = import('inspector').Profiler.ScriptCoverage[];

export type StrictGlobal = {
	writeCoverate?: (coverageData: CoverageData) => void;
	browser?: Browser | undefined;
	context?: BrowserContext | undefined;
	puppeteerConfig: PuppeteerConfig;
	httpAddress?: string;
};

export type JestPuppeteerGlobal = Required<StrictGlobal>;

export function GetPuppeteerConfig(): PuppeteerConfig {
	if (process.env.CI) {
		return {
			browserContext: 'incognito',
			launch: {
				headless: 'new',
				waitForInitialPage: false,
				args: [
					'--no-startup-window',
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-background-timer-throttling',
					'--disable-backgrounding-occluded-windows',
					'--disable-renderer-backgrounding',
				],
			},
		};
	}
	return {
		browserContext: 'incognito',
		launch: {
			headless: false,
			waitForInitialPage: false,
			args: [
				'--no-startup-window',
			],
		},
	};
}

// Ports and addresses
export const TEST_HTTP_SERVER_PORT = 10269;
export const TEST_CLIENT_DIRECTORY_ADDRESS = 'http://127.0.0.1:25560';
export const TEST_CLIENT_EDITOR_ASSETS_ADDRESS = 'http://127.0.0.1:26969/assets';

// Paths
export const TEST_PROJECT_PANDORA_DIR = path.resolve(process.cwd(), '..');
export const TEST_CLIENT_DIR = path.resolve(TEST_PROJECT_PANDORA_DIR, './pandora-client-web');

export const TEST_TEMP = path.resolve(process.cwd(), './temp');
export const TEST_CLIENT_DIST_DIR = path.resolve(TEST_TEMP, './client_dist');
