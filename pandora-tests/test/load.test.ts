import { test, expect } from '@playwright/test';
import { TestOpenPandora } from './utils/helpers';

test.describe('Load', () => {
	test('Should load Pandora', async ({ page }) => {
		await TestOpenPandora(page);

		await expect(page).toHaveTitle('Pandora');
	});

	test('Should load Editor', async ({ page }) => {
		await TestOpenPandora(page, '/editor');

		await expect(page).toHaveTitle('Pandora Editor');
	});
});
