import { test } from '@playwright/test';
import { SetupTestingEnv, TestOpenPandora } from './utils/helpers.ts';

SetupTestingEnv();

test.describe('Chat', () => {
	test('Personal space chat', async ({ page }) => {
		const client = await TestOpenPandora(page, { startServers: true });

		// Register and login
		await client.auth.flowRegisterActiveLogin({
			username: 'e2e_test_user',
			displayName: 'E2E Tester',
			email: 'e2e_test@project-pandora.com',
			password: 'testpassword123',
		});

		// Dismiss tutorial (auto-starts on first login)
		await client.tutorial.flowDismissTutorial();

		// Create character
		await client.characterSelect.flowCreateCharacter('Chat Test 1');

		// Verify personal space
		await client.room.waitForPersonalSpace();

		// Switch to Chat tab (personal space defaults to Personal space tab)
		await page.getByRole('tab', { name: 'Chat' }).click();

		// --- Send all message types ---

		await test.step('Normal chat', async () => {
			await client.roomChat.sendMessage('Hello from E2E test');
			await client.roomChat.waitForMessage('Hello from E2E test');

		});

		await test.step('Me emote', async () => {
			await client.roomChat.sendMessage('*waves hello*');
			await client.roomChat.waitForMessage('*Chat Test 1 waves hello*');

		});
		await test.step('Me emote (without ends)', async () => {
			// is still emote
			await client.roomChat.sendMessage('*waves hi');
			await client.roomChat.waitForMessage('*Chat Test 1 waves hi*');
		});

		await test.step('Emote', async () => {
			// name hidden
			await client.roomChat.sendMessage('**Surreptitiously glances around the corner**');
			await client.roomChat.waitForMessage('*Surreptitiously glances around the corner*');

		});
		await test.step('Emote (without ends)', async () => {
			// name hidden and still detected as emote
			await client.roomChat.sendMessage('**Quietly sips from a steaming cup of tea');
			await client.roomChat.waitForMessage('*Quietly sips from a steaming cup of tea*');
		});

		await test.step('OOC', async () => {
			await client.roomChat.sendMessage('((this is OOC))');
			await client.roomChat.waitForMessage('[OOC] Chat Test 1: (( this is OOC ))');

		});
		await test.step('OOC (without ends)', async () => {
			// still detected as OOC
			await client.roomChat.sendMessage('((this is also OOC');
			await client.roomChat.waitForMessage('[OOC] Chat Test 1: (( this is also OOC ))');
		});
	});
});
