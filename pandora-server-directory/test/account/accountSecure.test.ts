import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Account, CreateAccountData } from '../../src/account/account.ts';
import AccountSecure, { AccountToken, GenerateAccountSecureData, GenerateEmailHash } from '../../src/account/accountSecure.ts';
import { AccountTokenReason, DatabaseAccountToken } from '../../src/database/databaseStructure.ts';
import { MockDatabase } from '../../src/database/mockDb.ts';
import GetEmailSender from '../../src/services/email/index.ts';
import { TestMockDb } from '../utils.ts';

const TEST_USERNAME = 'testuser';
const TEST_EMAIL = 'test@project-pandora.com';
const TEST_EMAIL_HASH = GenerateEmailHash(TEST_EMAIL);

const TEST_CRYPT = {
	publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWDmwBlEMYi3nu7FsotmBDrHxxaX6rW8SaDQZkXPIAaofK4ZVD01Yac5yrMtX3/dWA8c720sGWQhhyyRkeEBB9Q==',
	salt: 'salt',
	iv: 'iv',
	encryptedPrivateKey: 'encryptedPrivateKey',
};

async function CreateAccountSecure(password: string, email: string, activated: boolean): Promise<AccountSecure> {
	const account = new Account({
		...await CreateAccountData(TEST_USERNAME, TEST_USERNAME, password, email, activated),
		id: 0,
	}, []);
	return account.secure;
}

describe('GenerateEmailHash()', () => {
	it('should return a string', () => {
		expect(typeof GenerateEmailHash(TEST_EMAIL)).toBe('string');
	});
});

describe('GenerateAccountSecureData()', () => {
	it('Should return account data', async () => {
		const result = await GenerateAccountSecureData('password', TEST_EMAIL);
		expect(typeof result).toBe('object');
		// Not activated by default
		expect(result.activated).toBe(false);
	});
	it('Allows creating activated account', async () => {
		const result = await GenerateAccountSecureData('password', TEST_EMAIL, true);
		expect(typeof result).toBe('object');
		expect(result.activated).toBe(true);
	});
});

describe('AccountSecure', () => {
	const email = GetEmailSender();
	const mockReset = jest.spyOn(email, 'sendPasswordReset').mockImplementation((_email: string, _username: string, _token: string): Promise<void> => {
		return Promise.resolve();
	});
	const mockRegistration = jest.spyOn(email, 'sendRegistrationConfirmation').mockImplementation((_email: string, _username: string, _token: string): Promise<void> => {
		return Promise.resolve();
	});
	const mockSaving = jest.spyOn(MockDatabase.prototype, 'setAccountSecure');

	beforeAll(async () => {
		await TestMockDb();
	});

	describe('isActivated()', () => {
		it('should return false for inactivated account', async () => {
			const inactive = await CreateAccountSecure('password', TEST_EMAIL, false);
			expect(inactive.isActivated()).toBe(false);
		});

		it('should return true for activated account', async () => {
			const active = await CreateAccountSecure('password', TEST_EMAIL, true);
			expect(active.isActivated()).toBe(true);
		});
	});

	describe('Account activation', () => {
		let account: AccountSecure;
		let activationToken1: string;
		let activationToken2: string;

		beforeAll(async () => {
			account = await CreateAccountSecure('password', TEST_EMAIL, false);
		});

		describe('sendActivation()', () => {
			it('Does nothing on active account', async () => {
				const activeAccount = await CreateAccountSecure('password', TEST_EMAIL, true);
				await activeAccount.sendActivation(TEST_EMAIL);
				expect(mockRegistration).not.toHaveBeenCalled();
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Does nothing when email is wrong', async () => {
				await account.sendActivation('nonexistent@project-pandora.com');
				expect(mockRegistration).not.toHaveBeenCalled();
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Sends email with token', async () => {
				await account.sendActivation(TEST_EMAIL);
				expect(mockRegistration).toHaveBeenCalledTimes(1);
				// Email, Username and Token
				expect(mockRegistration).toHaveBeenNthCalledWith(1, TEST_EMAIL, TEST_USERNAME, expect.any(String));
				// Save token for later use
				activationToken1 = mockRegistration.mock.calls[0][2];
				expect(activationToken1).toBeTruthy();
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});

			it('Sends email with token, again', async () => {
				await account.sendActivation(TEST_EMAIL);
				expect(mockRegistration).toHaveBeenCalledTimes(1);
				// Email, Username and Token
				expect(mockRegistration).toHaveBeenNthCalledWith(1, TEST_EMAIL, TEST_USERNAME, expect.any(String));
				// Save token for later use
				activationToken2 = mockRegistration.mock.calls[0][2];
				expect(activationToken2).toBeTruthy();
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});
		});

		describe('activateAccount()', () => {
			it('Fails on active account', async () => {
				const activeAccount = await CreateAccountSecure('password', TEST_EMAIL, true);
				expect(await activeAccount.activateAccount('token')).toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Fails with wrong token', async () => {
				expect(await account.activateAccount('wrongToken')).toBe(false);
				expect(account.isActivated()).toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Fails with wrong token type', async () => {
				const token = await account.generateNewLoginToken();
				mockSaving.mockClear();
				expect(await account.activateAccount(token.value)).toBe(false);
				expect(account.isActivated()).toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Fails with replaced token', async () => {
				expect(await account.activateAccount(activationToken1)).toBe(false);
				expect(account.isActivated()).toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Activates account with correct token', async () => {
				expect(await account.activateAccount(activationToken2)).toBe(true);
				expect(account.isActivated()).toBe(true);
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe('verifyEmail()', () => {
		let active: AccountSecure;
		let inactive: AccountSecure;

		beforeAll(async () => {
			active = await CreateAccountSecure('password', TEST_EMAIL, true);
			inactive = await CreateAccountSecure('password', TEST_EMAIL, false);
		});

		it('Returns false with wrong email', () => {
			expect(active.verifyEmail('nonexistent@project-pandora.com')).toBe(false);
			expect(inactive.verifyEmail('nonexistent@project-pandora.com')).toBe(false);
		});

		it('Returns true with correct email', () => {
			expect(active.verifyEmail(TEST_EMAIL)).toBe(true);
			expect(inactive.verifyEmail(TEST_EMAIL)).toBe(true);
		});

		it('Ignores email case', () => {
			expect(active.verifyEmail(TEST_EMAIL.toLowerCase())).toBe(true);
			expect(active.verifyEmail(TEST_EMAIL.toUpperCase())).toBe(true);
			expect(inactive.verifyEmail(TEST_EMAIL.toLowerCase())).toBe(true);
			expect(inactive.verifyEmail(TEST_EMAIL.toUpperCase())).toBe(true);
		});
	});

	describe('verifyEmailHash()', () => {
		let active: AccountSecure;
		let inactive: AccountSecure;

		beforeAll(async () => {
			active = await CreateAccountSecure('password', TEST_EMAIL, true);
			inactive = await CreateAccountSecure('password', TEST_EMAIL, false);
		});

		it('Returns false with wrong email hash', () => {
			expect(active.verifyEmailHash('wrongHash')).toBe(false);
			expect(inactive.verifyEmailHash('wrongHash')).toBe(false);
		});

		it('Returns true with correct email hash', () => {
			expect(active.verifyEmailHash(TEST_EMAIL_HASH)).toBe(true);
			expect(inactive.verifyEmailHash(TEST_EMAIL_HASH)).toBe(true);
		});
	});

	describe('verifyPassword()', () => {
		let active: AccountSecure;
		let inactive: AccountSecure;

		beforeAll(async () => {
			active = await CreateAccountSecure('password', TEST_EMAIL, true);
			inactive = await CreateAccountSecure('password', TEST_EMAIL, false);
		});

		it('Returns false with wrong password', async () => {
			await expect(active.verifyPassword('wrongPassword')).resolves.toBe(false);
			await expect(active.verifyPassword('Password')).resolves.toBe(false);
			await expect(inactive.verifyPassword('wrongPassword')).resolves.toBe(false);
			await expect(inactive.verifyPassword('Password')).resolves.toBe(false);
		});

		it('Returns true with correct password', async () => {
			await expect(active.verifyPassword('password')).resolves.toBe(true);
			await expect(inactive.verifyPassword('password')).resolves.toBe(true);
		});
	});

	describe('changePassword()', () => {
		let account: AccountSecure;

		beforeAll(async () => {
			account = await CreateAccountSecure('password', TEST_EMAIL, true);
		});

		it('Fails on inactive account', async () => {
			const inactiveAccount = await CreateAccountSecure('password', TEST_EMAIL, false);
			await expect(inactiveAccount.changePassword('password', 'newPassword', TEST_CRYPT)).resolves.toBe(false);
			await expect(inactiveAccount.verifyPassword('password')).resolves.toBe(true);
			await expect(inactiveAccount.verifyPassword('newPassword')).resolves.toBe(false);
			expect(mockSaving).not.toHaveBeenCalled();
		});

		it('Fails if old password is incorrect', async () => {
			await expect(account.changePassword('wrongPassword', 'newPassword', TEST_CRYPT)).resolves.toBe(false);
			await expect(account.verifyPassword('password')).resolves.toBe(true);
			await expect(account.verifyPassword('newPassword')).resolves.toBe(false);
			expect(mockSaving).not.toHaveBeenCalled();
		});

		it('Changes password', async () => {
			await expect(account.changePassword('password', 'newPassword', TEST_CRYPT)).resolves.toBe(true);
			// Old password is no longer valid
			await expect(account.verifyPassword('password')).resolves.toBe(false);
			// New password is valid
			await expect(account.verifyPassword('newPassword')).resolves.toBe(true);
			// Saves data
			expect(mockSaving).toHaveBeenCalledTimes(1);
		});
	});

	describe('Password reset', () => {
		let account: AccountSecure;
		let resetToken: string;

		beforeAll(async () => {
			account = await CreateAccountSecure('password', TEST_EMAIL, false);
		});

		describe('resetPassword()', () => {
			it('Does nothing when email is wrong', async () => {
				await expect(account.resetPassword('nonexistent@project-pandora.com')).resolves.toBe(false);
				expect(mockReset).not.toHaveBeenCalled();
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Sends email with token', async () => {
				await expect(account.resetPassword(TEST_EMAIL)).resolves.toBe(true);
				expect(mockReset).toHaveBeenCalledTimes(1);
				// Email, Username and Token
				expect(mockReset).toHaveBeenNthCalledWith(1, TEST_EMAIL, TEST_USERNAME, expect.any(String));
				// Save token for later use
				resetToken = mockReset.mock.calls[0][2];
				expect(resetToken).toBeTruthy();
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});
		});

		describe('finishPasswordReset()', () => {
			it('Fails with wrong token', async () => {
				expect(await account.finishPasswordReset('wrongToken', 'newPassword')).toBe(false);
				await expect(account.verifyPassword('password')).resolves.toBe(true);
				await expect(account.verifyPassword('newPassword')).resolves.toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Changes password with correct token', async () => {
				// Assertion: Not active before this test
				expect(account.isActivated()).toBe(false);

				await expect(account.finishPasswordReset(resetToken, 'newPassword')).resolves.toBe(true);
				// Old password is no longer valid
				await expect(account.verifyPassword('password')).resolves.toBe(false);
				// New password is valid
				await expect(account.verifyPassword('newPassword')).resolves.toBe(true);
				// Activates account
				expect(account.isActivated()).toBe(true);
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});

			it('Invalidates token after use', async () => {
				expect(await account.finishPasswordReset(resetToken, 'thirdPassword')).toBe(false);
				await expect(account.verifyPassword('newPassword')).resolves.toBe(true);
				await expect(account.verifyPassword('thirdPassword')).resolves.toBe(false);
				expect(mockSaving).not.toHaveBeenCalled();
			});
		});
	});

	describe('Login tokens', () => {
		let account: AccountSecure;
		let token1: DatabaseAccountToken;
		let token2: DatabaseAccountToken;

		beforeAll(async () => {
			jest.useFakeTimers();
			account = await CreateAccountSecure('password', TEST_EMAIL, true);
		});
		afterAll(() => {
			jest.useRealTimers();
		});

		describe('generateNewLoginToken()', () => {
			it('Generates new tokens', async () => {
				const timeBefore = Date.now();
				token1 = await account.generateNewLoginToken();
				token2 = await account.generateNewLoginToken();
				// Reason is login
				expect(token1.reason).toBe(AccountTokenReason.LOGIN);
				expect(token2.reason).toBe(AccountTokenReason.LOGIN);
				// Tokens expire in future
				expect(token1.expires).toBeGreaterThan(timeBefore);
				expect(token2.expires).toBeGreaterThan(timeBefore);
				// Tokens are different
				expect(token1.value).not.toBe(token2.value);
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(2);
			});
		});

		describe('getLoginToken()', () => {
			it('Returns false with wrong token', () => {
				expect(account.getLoginToken('wrongToken')).toBeUndefined();
			});

			it('Returns true with valid token', () => {
				expect(account.getLoginToken(token1.value)).toBeDefined();
				expect(account.getLoginToken(token2.value)).toBeDefined();
			});
		});

		describe('invalidateLoginToken()', () => {
			it('Does nothing with unknown token', async () => {
				await account.invalidateLoginToken('wrongToken');
				expect(mockSaving).not.toHaveBeenCalled();
			});

			it('Invalidates valid token', async () => {
				expect(account.getLoginToken(token1.value)).toBeDefined();

				await account.invalidateLoginToken(token1.value.substring(0, AccountToken.create(AccountTokenReason.LOGIN).getId().length));

				expect(account.getLoginToken(token1.value)).toBeUndefined();
				// Other tokens are unaffected
				expect(account.getLoginToken(token2.value)).toBeDefined();
				// Saves data
				expect(mockSaving).toHaveBeenCalledTimes(1);
			});
		});

		it('Tokens timeout', () => {
			expect(account.getLoginToken(token2.value)).toBeDefined();
			jest.setSystemTime(token2.expires + 1);
			expect(account.getLoginToken(token2.value)).toBeUndefined();
		});
	});
});
