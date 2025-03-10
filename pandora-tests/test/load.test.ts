import { expect, test } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers.ts';

SetupTestingEnv();

test.describe('Load', () => {
	test('Should load Pandora', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: false });

		await expect(page).toHaveTitle('Pandora');
	});

	test('Should load Editor', async ({ page }) => {
		await TestOpenPandora(page, {
			path: '/editor',
			agreeEula: false,
		});

		await expect(page).toHaveTitle('Pandora Editor');
	});
});
