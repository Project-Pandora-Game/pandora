import { test, expect } from '@playwright/test';
import { TestOpenPandora } from './utils/helpers';

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

	test('EULA guards non-index pages', async ({ page }) => {
		await TestOpenPandora(page, '/login');

		// Disagree button should navigate away from pandora
		await expect(page.getByRole('button', { name: 'Disagree' })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Agree/ })).toBeVisible();
	});

	test('Agree opens login', async ({ page }) => {
		await TestOpenPandora(page);

		// Agree button opens login
		await page.getByRole('button', { name: /^Agree/ }).click();

		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	});

	test('Agreement is remembered', async ({ page }) => {
		await TestOpenPandora(page);

		await page.getByRole('button', { name: /^Agree/ }).click();
		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

		await page.reload();

		// No agreement needed
		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	});
});
