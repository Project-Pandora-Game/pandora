import { expect, test } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers.ts';
import { TestStartDirectory } from './utils/server.ts';

SetupTestingEnv();

test.beforeAll(async () => {
	await TestStartDirectory({ keepActive: true });
});

test.describe('Wiki', () => {
	test('Selects default tab', async ({ page }) => {
		await TestOpenPandora(page, { path: '/wiki' });

		await page.waitForURL('/wiki/introduction');
		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab active');
		await expect(page.getByRole('heading', { name: 'Introduction to Pandora' })).toBeVisible();
	});

	test('Loads specific tab directly based on url', async ({ page }) => {
		await TestOpenPandora(page, { path: '/wiki/history' });

		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab');
		await expect(page.getByRole('tab', { name: 'Pandora History' })).toHaveClass('tab active');
		await expect(page.getByRole('heading', { name: `Pandora's history`, exact: true })).toBeVisible();
	});

	test('Switches tabs', async ({ page }) => {
		await TestOpenPandora(page, { path: '/wiki/introduction' });

		// Initial tab is introcution
		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab active');
		await expect(page.getByRole('tab', { name: 'Contact' })).toHaveClass('tab');
		await expect(page.getByRole('heading', { name: 'Introduction to Pandora' })).toBeVisible();
		await page.waitForURL('/wiki/introduction');

		// Nothing changes when clicking already selected tab
		await page.getByRole('tab', { name: 'Introduction' }).click();
		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab active');
		await expect(page.getByRole('tab', { name: 'Contact' })).toHaveClass('tab');
		await expect(page.getByRole('heading', { name: 'Introduction to Pandora' })).toBeVisible();
		await page.waitForURL('/wiki/introduction');

		// Switch to tab "Contact"
		await page.getByRole('tab', { name: 'Contact' }).click();
		await expect(page.getByRole('tab', { name: 'Contact' })).toHaveClass('tab active');
		await expect(page.getByRole('heading', { name: 'Contact Us', exact: true })).toBeVisible();
		await page.waitForURL('/wiki/contact');

		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab');
		await expect(page.getByRole('heading', { name: 'Introduction to Pandora' })).not.toBeVisible();
	});

	test('Uses back button', async ({ page }) => {
		await TestOpenPandora(page, { path: '/wiki/introduction' });

		// Initial tab is introcution
		await expect(page.getByRole('tab', { name: 'Introduction' })).toHaveClass('tab active');
		await page.getByRole('tab', { name: 'Back' }).click();
		await page.waitForURL('/login');
	});
});
