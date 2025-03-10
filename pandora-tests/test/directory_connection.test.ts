import { expect, test } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers.ts';
import { TestStartDirectory, TestStopDirectory } from './utils/server.ts';

SetupTestingEnv();

test.describe('Directory Connection', () => {
	test('Should see directory toast when directory is not running', async ({ page }) => {
		await TestOpenPandora(page);

		await expect(page.getByText('Connecting to Directory...')).toBeVisible();
	});

	test('Should connect when directory starts', async ({ page }) => {
		await TestOpenPandora(page);

		await expect(page.getByText('Connecting to Directory...')).toBeVisible();

		const connectedPrompt = expect(page.getByText('Connected to Directory')).toBeVisible({ timeout: 30_000 });
		await TestStartDirectory();

		await connectedPrompt;
		await expect(page.getByText('Connecting to Directory...')).toBeHidden();
	});

	test('Should show information about directory connection being lost', async ({ page }) => {
		await TestOpenPandora(page);

		// Wait for connection
		const connectedPrompt = expect(page.getByText('Connected to Directory')).toBeVisible({ timeout: 30_000 });
		await TestStartDirectory();
		await connectedPrompt;

		// Stop directory and check for warning toast
		await TestStopDirectory();
		await expect(page.getByText('Directory connection lost')).toBeVisible({ timeout: 10_000 });
	});

	test('Should show information about directory reconnection', async ({ page }) => {
		await TestOpenPandora(page);

		// Wait for connection
		const connectedPrompt = expect(page.getByText('Connected to Directory')).toBeVisible({ timeout: 30_000 });
		await TestStartDirectory();
		await connectedPrompt;

		// Stop directory and check for warning toast
		await TestStopDirectory();
		await expect(page.getByText('Directory connection lost')).toBeVisible({ timeout: 10_000 });

		// Restart directory, expecting reconnect
		const reconnectedPrompt = expect(page.getByText('Reconnected to Directory')).toBeVisible({ timeout: 30_000 });
		await TestStartDirectory();
		await reconnectedPrompt;

		await expect(page.getByText('Directory connection lost')).toBeHidden();
	});
});
