import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Account } from '../../src/account/account.ts';
import { accountManager } from '../../src/account/accountManager.ts';
import { GetDatabase } from '../../src/database/databaseProvider.ts';
import { TestMockAccount, TestMockDb } from '../utils.ts';

const TEST_CRYPT = {
	publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWDmwBlEMYi3nu7FsotmBDrHxxaX6rW8SaDQZkXPIAaofK4ZVD01Yac5yrMtX3/dWA8c720sGWQhhyyRkeEBB9Q==',
	salt: 'salt',
	iv: 'iv',
	encryptedPrivateKey: 'encryptedPrivateKey',
};

describe('AccountDirectMessages.getMessages()', () => {
	let sender: Account;
	let target: Account;

	beforeAll(async () => {
		await TestMockDb();
	});

	beforeEach(async () => {
		accountManager.init();
		sender = await TestMockAccount();
		target = await TestMockAccount();
		expect(await sender.secure.setCryptoKey(TEST_CRYPT)).toBe('ok');
		expect(await target.secure.setCryptoKey(TEST_CRYPT)).toBe('ok');
	});

	afterEach(async () => {
		await accountManager.onDestroyCharacters();
		accountManager.onDestroyAccounts();
	});

	it('allows a new conversation when the target accepts DMs from everyone', async () => {
		expect(target.getEffectiveSettings().allowDirectMessagesFrom).toBe('all');
		await expect(sender.directMessages.getMessages(target.id)).resolves.toMatchObject({
			result: 'ok',
			account: { id: target.id, publicKeyData: TEST_CRYPT.publicKey },
			messages: [],
		});
	});

	it('denies a blocked requester with no history', async () => {
		expect(await target.contacts.block(sender.id)).toBe(true);
		await expect(sender.directMessages.getMessages(target.id)).resolves.toEqual({ result: 'denied' });
	});

	it('denies an unrelated requester when DMs are restricted', async () => {
		await target.changeSettings({ allowDirectMessagesFrom: 'friends' });
		await expect(sender.directMessages.getMessages(target.id)).resolves.toEqual({ result: 'denied' });
	});

	it('preserves access to existing messages after a later block', async () => {
		const accounts = `${Math.min(sender.id, target.id)}-${Math.max(sender.id, target.id)}` as const;
		const original = { content: 'encrypted', source: sender.id, time: 100 };
		expect(await GetDatabase().setDirectMessage(accounts, 'key-hash', original, 10)).toBe(true);
		expect(await target.contacts.block(sender.id)).toBe(true);

		await expect(sender.directMessages.getMessages(target.id)).resolves.toMatchObject({
			result: 'ok',
			account: { id: target.id, publicKeyData: TEST_CRYPT.publicKey },
			messages: [{ ...original, keyHash: 'key-hash' }],
		});
	});
});
