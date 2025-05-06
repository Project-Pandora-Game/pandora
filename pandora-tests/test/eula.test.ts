import { expect, test } from '@playwright/test';
import { SetupTestingEnv, TEST_EULA_TEXT, TestOpenPandora } from './utils/helpers.ts';

SetupTestingEnv();

test.describe('EULA', () => {
	test('Shows privacy policy', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: false });
		await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();

		// Click privacy policy link
		await page.getByRole('button', { name: 'privacy policy' }).click();

		// We should see the policy
		await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();

		// There should be a close button to close it
		await page.getByRole('button', { name: 'Close' }).click();

		await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeHidden();
	});

	test('Disagree navigates away', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: false });
		await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();

		// Disagree button should navigate away from pandora
		await page.getByRole('button', { name: 'Disagree' }).click();

		await page.waitForFunction(() => window.location.href === 'about:blank');
	});

	test('EULA guards non-index pages', async ({ page }) => {
		await TestOpenPandora(page, {
			path: '/login',
			agreeEula: false,
		});

		await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Disagree' })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Agree/ })).toBeVisible();
	});

	test('Agree opens login', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: false });
		await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();

		// Agree button opens login
		await page.getByRole('button', { name: /^Agree/ }).click();

		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	});

	test('Agreement is remembered', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: false });
		await expect(page.getByText(TEST_EULA_TEXT)).toBeVisible();

		await page.getByRole('button', { name: /^Agree/ }).click();
		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

		await page.reload();

		// No agreement needed
		await expect(page.getByText(TEST_EULA_TEXT)).not.toBeVisible();
		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	});

	test('Test auto-agreement works', async ({ page }) => {
		await TestOpenPandora(page, { agreeEula: true });

		// No agreement needed
		await expect(page.getByText(TEST_EULA_TEXT)).not.toBeVisible();
		await page.waitForURL('/login');
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	});

	test('Agreement works in editor', async ({ page }) => {
		await TestOpenPandora(page, {
			path: '/editor',
			agreeEula: true,
		});

		// No agreement needed
		await expect(page.getByText(TEST_EULA_TEXT)).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Load Assets From Local Development Server', exact: true })).toBeVisible();
	});
});
