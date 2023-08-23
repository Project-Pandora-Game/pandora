import { ConsoleMessage, Page } from '@playwright/test';

const handleLog = (message: ConsoleMessage) => {
	if (message.type() === 'error') {
		// eslint-disable-next-line no-console
		console.error(
			'Page emitted error log:\n',
			message.text(),
		);
		throw new Error('Page emitted error log');
	}
};

// eslint-disable-next-line @typescript-eslint/require-await
export async function TestSetupPage(page: Page): Promise<void> {
	page.on('console', handleLog);
}

export async function TestOpenPandora(page: Page, path: `/${string}` = '/'): Promise<void> {
	await TestSetupPage(page);

	await page.goto(path);
}
