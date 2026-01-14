import { ConsoleMessage, Page, test } from '@playwright/test';
import { GetClientHandler, type ClientHandler } from './_clientHandler.ts';
import { CoverageProcessPage } from './coverage.ts';
import { InternalSetupTestingEnvServers, TestStartDirectory, TestStartShard } from './server.ts';
import { Sleep } from './utils.ts';
import { InternalSetupTestingWebListener } from './webListener.ts';

const handleLog = (message: ConsoleMessage) => {
	if (message.type() === 'error') {
		// Ignore socket.io errors (some tests test non-working server connection)
		if (message.location().url.includes('/socket.io/'))
			return;

		// eslint-disable-next-line no-console
		console.error(
			'Page emitted error log:\n',
			message.text(),
			'\n',
			message.location(),
		);
		throw new Error('Page emitted error log');
	}
};

export async function TestSetupPage(page: Page): Promise<void> {
	page.on('console', handleLog);

	await page.coverage.startJSCoverage({
		resetOnNavigation: false,
	});

	pagesToCleanup.push(page);
}

interface TestOpenPandoraOptions {
	/** @default '/' */
	path?: `/${string}`;
	/** @default true */
	agreeEula?: boolean;

	/** @default false */
	startServers?: boolean;
}

export async function TestOpenPandora(page: Page, options: TestOpenPandoraOptions = {}): Promise<ClientHandler> {
	if (options.startServers ?? false) {
		await TestStartDirectory();
		await TestStartShard();
	}

	await TestSetupPage(page);

	await page.goto(options.path ?? '/');

	const handler = GetClientHandler(page);

	if (options.agreeEula !== false) {
		await handler.eula.agree();
		await Sleep(200); // HACK: Give things time to initialize
	}

	return handler;
}

// Coverage helpers
const pagesToCleanup: Page[] = [];

// This unfortunately needs to happen manually as the file is imported only once
export function SetupTestingEnv(): void {
	test.afterEach('Page cleanup', async ({ baseURL }): Promise<void> => {
		for (let i = pagesToCleanup.length - 1; i >= 0; i--) {
			const page = pagesToCleanup[i];
			pagesToCleanup.splice(i, 1);

			await CoverageProcessPage(page, baseURL);
		}
	});

	InternalSetupTestingWebListener();
	InternalSetupTestingEnvServers();
}
