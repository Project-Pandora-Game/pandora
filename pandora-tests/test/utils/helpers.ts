import { ConsoleMessage, Page, expect, test } from '@playwright/test';
import { CoverageProcessPage } from './coverage.ts';
import { InternalSetupTestingEnvDirectory } from './server.ts';

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
}

export async function TestOpenPandora(page: Page, options: TestOpenPandoraOptions = {}): Promise<void> {
	await TestSetupPage(page);

	await page.goto(options.path ?? '/');

	if (options.agreeEula !== false) {
		await TestPandoraAgreeEula(page);
	}
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

	InternalSetupTestingEnvDirectory();
}

// EULA helper
export const TEST_EULA_TEXT = 'By playing this game, you agree to the following:';
async function TestPandoraAgreeEula(page: Page): Promise<void> {
	await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();
	await page.getByRole('button', { name: /^Agree/ }).click();
	await expect(page.getByText(TEST_EULA_TEXT)).not.toBeVisible();
}
