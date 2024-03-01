import { test, expect } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers';
import { TestStartDirectory, TestStopDirectory } from './utils/server';

SetupTestingEnv();

test.describe('Directory Connection', () => {
	test('Should see directory toast when directory is not running', async ({ page }) => {
		await TestOpenPandora(page);

		await expect(page.getByText('Connecting to Directory...')).toBeVisible();
	});

	test('Should connect when directory starts', async ({ page }) => {
		await TestOpenPandora(page);

		await expect(page.getByText('Connecting to Directory...')).toBeVisible();

		await TestStartDirectory();

		await expect(page.getByText('Connected to Directory')).toBeVisible();
		await expect(page.getByText('Connecting to Directory...')).toBeHidden();
	});

	test('Should show information about directory connection being lost', async ({ page }) => {
		await TestOpenPandora(page);
		await TestStartDirectory();

		// Wait for connection
		await expect(page.getByText('Connected to Directory')).toBeVisible();

		// Stop directory and check for warning toast
		await TestStopDirectory();
		await expect(page.getByText('Directory connection lost')).toBeVisible();
	});

	test('Should show information about directory reconnection', async ({ page }) => {
		await TestOpenPandora(page);
		await TestStartDirectory();

		// Wait for connection
		await expect(page.getByText('Connected to Directory')).toBeVisible();

		// Stop directory and check for warning toast
		await TestStopDirectory();
		await expect(page.getByText('Directory connection lost')).toBeVisible();

		// Restart directory, expecting reconnect
		await TestStartDirectory();

		await expect(page.getByText('Reconnected to Directory')).toBeVisible();
		await expect(page.getByText('Directory connection lost')).toBeHidden();
	});
});
