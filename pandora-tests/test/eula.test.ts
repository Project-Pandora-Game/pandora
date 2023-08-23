import { test, expect } from '@playwright/test';
import { TestOpenPandora } from './utils/helpers';

test.describe('Load', () => {
	test('Should load Pandora', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveTitle('Pandora');
	});

	test('Should load Editor', async ({ page }) => {
		await page.goto('/editor');

		await expect(page).toHaveTitle('Pandora Editor');
	});
});

test.describe('EULA', () => {
	test('Shows privacy policy', async ({ page }) => {
		await TestOpenPandora(page);

		// Click privacy policy link
		await page.getByRole('button', { name: 'privacy policy' }).click();

		// We should see the policy
		await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();

		// There should be a close button to close it
		await page.getByRole('button', { name: 'Close' }).click();

		await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeHidden();
	});

	test('Disagree navigates away', async ({ page }) => {
		await TestOpenPandora(page);

		// Disagree button should navigate away from pandora
		await page.getByRole('button', { name: 'Disagree' }).click();

		await page.waitForURL('about:blank');
	});
});
