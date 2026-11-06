import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { CreateManuallyResolvedPromise } from 'pandora-common';

let pendingHash: Promise<string> | null = null;
let pendingVerify: Promise<boolean> | null = null;

// Control the asynchronous hashing boundary without relying on hashing speed.
jest.unstable_mockModule('argon2', () => ({
	argon2id: 2,
	hash: async (password: string) => password === 'recovered-password' && pendingHash != null ? pendingHash : `hash:${ password }`,
	verify: async (hash: string, password: string) => pendingVerify ?? hash === `hash:${ password }`,
}));

const { TestMockAccount, TestMockDb } = await import('../utils.ts');
const { default: GetEmailSender } = await import('../../src/services/email/index.ts');
const { PrehashPassword } = await import('../../src/database/mockDb.ts');
const OLD_PASSWORD = PrehashPassword('old-password');

beforeAll(async () => {
	await TestMockDb();
});

afterEach(() => {
	pendingHash = null;
	pendingVerify = null;
	jest.restoreAllMocks();
});

let accountNumber = 0;
async function CreateRecoveryAccount() {
	const email = `recovery-race-${ ++accountNumber }@example.com`;
	const account = await TestMockAccount({ username: `recovery-race-${ accountNumber }`, password: 'old-password', email });
	const sendReset = jest.spyOn(GetEmailSender(), 'sendPasswordReset').mockResolvedValue();
	await account.secure.resetPassword(email);
	const token = sendReset.mock.calls.at(-1)?.[2];
	if (token == null)
		throw new Error('No recovery token was issued');
	return { secure: account.secure, token, email, sendReset };
}

describe('password recovery asynchronous boundaries', () => {
	it('revokes login tokens issued while the new password is being hashed', async () => {
		const { secure, token } = await CreateRecoveryAccount();
		const hash = CreateManuallyResolvedPromise<string>();
		pendingHash = hash.promise;
		const recovering = secure.finishPasswordReset(token, 'recovered-password');
		const login = await secure.generateNewLoginToken();
		expect(secure.getLoginToken(login.value)).toBe(login);
		hash.resolve('hash:recovered-password');
		await expect(recovering).resolves.toBe(true);
		expect(secure.getLoginToken(login.value)).toBeUndefined();
		await expect(secure.verifyPassword(OLD_PASSWORD)).resolves.toBe(false);
	});

	it('does not finish recovery with a token replaced during password hashing', async () => {
		const { secure, token, email } = await CreateRecoveryAccount();
		const hash = CreateManuallyResolvedPromise<string>();
		pendingHash = hash.promise;
		const recovering = secure.finishPasswordReset(token, 'recovered-password');
		await secure.resetPassword(email);
		hash.resolve('hash:recovered-password');
		await expect(recovering).resolves.toBe(false);
		await expect(secure.verifyPassword(OLD_PASSWORD)).resolves.toBe(true);
	});

	it('preserves credentials and the reset token when hashing fails', async () => {
		const { secure, token } = await CreateRecoveryAccount();
		const login = await secure.generateNewLoginToken();
		const hash = CreateManuallyResolvedPromise<string>();
		pendingHash = hash.promise;
		const recovering = secure.finishPasswordReset(token, 'recovered-password');
		const failed = expect(recovering).rejects.toThrow('hash failed');
		hash.reject(new Error('hash failed'));
		await failed;
		expect(secure.getLoginToken(login.value)).toBe(login);
		await expect(secure.verifyPassword(OLD_PASSWORD)).resolves.toBe(true);
		pendingHash = null;
		await expect(secure.finishPasswordReset(token, 'recovered-password')).resolves.toBe(true);
	});

	it('rejects an old-password verification that finishes after recovery', async () => {
		const { secure, token } = await CreateRecoveryAccount();
		const verification = CreateManuallyResolvedPromise<boolean>();
		pendingVerify = verification.promise;
		const verifying = secure.verifyPassword(OLD_PASSWORD);
		await expect(secure.finishPasswordReset(token, 'recovered-password')).resolves.toBe(true);
		verification.resolve(true);
		await expect(verifying).resolves.toBe(false);
	});
});
