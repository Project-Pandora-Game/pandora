import { expect, test } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers.ts';

SetupTestingEnv();

test.describe('Registration', () => {
	test('Can register, activate, and log into a new account', async ({ page }) => {
		const client = await TestOpenPandora(page, { startServers: true });

		await expect(client.page.getByTestId('current-account')).toContainText('[not logged in]');

		await client.auth.flowRegisterActiveLogin({
			username: 'testuser',
			displayName: 'Testy',
			email: 'testuseremail@project-pandora.com',
			password: '12345678',
		});

		await expect(client.page.getByTestId('current-account')).toContainText('Testy');
	});
});
