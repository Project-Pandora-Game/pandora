import { test, expect } from '@playwright/test';

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
