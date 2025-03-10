import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Account, CreateAccountData } from '../../src/account/account.ts';
import { ACCOUNT_INACTIVITY_THRESHOLD, accountManager, ACCOUNTMANAGER_TICK_INTERVAL } from '../../src/account/accountManager.ts';
import AccountSecure, { GenerateEmailHash } from '../../src/account/accountSecure.ts';
import { MockDatabase, PrehashPassword } from '../../src/database/mockDb.ts';
import { TestMockDb } from '../utils.ts';

const TEST_USERNAME = 'testuser';
const TEST_DISPLAYNAME = 'TestUserDisplay';
const TEST_USERNAME_DIFFERENT_CASE = TEST_USERNAME.toUpperCase();
const TEST_EMAIL = 'test@project-pandora.com';
const TEST_EMAIL_HASH = GenerateEmailHash(TEST_EMAIL);

describe('AccountManager', () => {
	let mockDb: MockDatabase;
	let testAccountId: number;

	beforeAll(async () => {
		mockDb = await TestMockDb();
		// Create at least one account
		await mockDb.createAccount(await CreateAccountData(
			'backgroundAccount',
			'backgroundAccount',
			PrehashPassword('test'),
			'backgroundAccount@project-pandora.com',
			true,
		));

		// Check data is what we expect
		expect(TEST_USERNAME_DIFFERENT_CASE).not.toBe(TEST_USERNAME);
		expect(TEST_USERNAME_DIFFERENT_CASE.toLowerCase()).toBe(TEST_USERNAME.toLowerCase());
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		accountManager.init();
		// Make sure at least one account is loaded already before testing
		await expect(accountManager.loadAccountByUsername('backgroundAccount')).resolves.toBeInstanceOf(Account);
	});
	afterEach(async () => {
		await accountManager.onDestroyCharacters();
		accountManager.onDestroyAccounts();
		jest.useRealTimers();
	});

	it('Doesn\'t crash on double init and double destroy', async () => {
		accountManager.init();
		accountManager.init();
		await accountManager.onDestroyCharacters();
		accountManager.onDestroyAccounts();
		await accountManager.onDestroyCharacters();
		accountManager.onDestroyAccounts();
	});

	describe('createAccount()', () => {
		it('Creates account', async () => {
			const sendObserver = jest.spyOn(AccountSecure.prototype, 'sendActivation');

			const result = await accountManager.createAccount(TEST_USERNAME, TEST_DISPLAYNAME, 'password', TEST_EMAIL);

			expect(result).toBeInstanceOf(Account);
			const acc = result as Account;
			// Save ID for other tests
			testAccountId = acc.id;

			// The database has the account
			await expect(mockDb.getAccountById(acc.id)).resolves.toEqual(
				expect.objectContaining({
					id: acc.id,
					username: TEST_USERNAME,
					settings: {
						displayName: TEST_DISPLAYNAME,
					},
				}),
			);
			// The account is not active
			expect(acc.isActivated()).toBe(false);
			// The activation email has been sent
			expect(sendObserver).toHaveBeenCalledTimes(1);
			expect(sendObserver).toHaveBeenNthCalledWith(1, TEST_EMAIL);
			// The account is loaded
			expect(accountManager.getAccountById(acc.id)).toBe(acc);
		});

		it('Returns same error as database', async () => {
			await expect(accountManager.createAccount(TEST_USERNAME, TEST_DISPLAYNAME, 'password', 'nonexistent@project-pandora.com'))
				.resolves.toBe('usernameTaken');
			await expect(accountManager.createAccount(TEST_USERNAME_DIFFERENT_CASE, TEST_DISPLAYNAME, 'password', 'nonexistent@project-pandora.com'))
				.resolves.toBe('usernameTaken');
			await expect(accountManager.createAccount('nonexistent', TEST_DISPLAYNAME, 'password', TEST_EMAIL))
				.resolves.toBe('emailTaken');
		});
	});

	describe('Querying accounts by ID', () => {
		it('Doesn\'t find unknown account', async () => {
			expect(accountManager.getAccountById(999)).toBe(null);
			await expect(accountManager.loadAccountById(999)).resolves.toBe(null);
		});

		it('Loads existing account', async () => {
			// Not loaded at first
			expect(accountManager.getAccountById(testAccountId)).toBe(null);

			// Gets loaded by load
			const account = await accountManager.loadAccountById(testAccountId);
			expect(account).toBeInstanceOf(Account);
			expect((account as Account).id).toBe(testAccountId);

			// Get returns loaded account
			expect(accountManager.getAccountById(testAccountId)).toBe(account);
			await expect(accountManager.loadAccountById(testAccountId)).resolves.toBe(account);
		});

		it('Avoids race conditions', async () => {
			// Not loaded at first
			expect(accountManager.getAccountById(testAccountId)).toBe(null);

			let resume1!: () => void;
			let resume2!: () => void;

			jest.spyOn(MockDatabase.prototype, 'getAccountById')
				.mockImplementationOnce((id) => new Promise((resolve) => {
					resume1 = () => {
						resolve(mockDb.getAccountById(id));
					};
				}))
				.mockImplementationOnce((id) => new Promise((resolve) => {
					resume2 = () => {
						resolve(mockDb.getAccountById(id));
					};
				}));

			// Try to load two at the same time
			const promise1 = accountManager.loadAccountById(testAccountId);
			const promise2 = accountManager.loadAccountById(testAccountId);

			// Finish both
			expect(resume1).toBeDefined();
			expect(resume2).toBeDefined();
			resume2();
			resume1();

			await promise1;
			await promise2;

			// Account is loaded after
			const account = accountManager.getAccountById(testAccountId);
			expect(account).toBeInstanceOf(Account);

			// No race condition
			await expect(promise1).resolves.toBe(account);
			await expect(promise2).resolves.toBe(account);
		});
	});

	describe('Querying accounts by Username', () => {
		it('Doesn\'t find unknown account', async () => {
			expect(accountManager.getAccountByUsername('nonexistent')).toBe(null);
			await expect(accountManager.loadAccountByUsername('nonexistent')).resolves.toBe(null);
		});

		it('Loads existing account', async () => {
			// Not loaded at first
			expect(accountManager.getAccountByUsername(TEST_USERNAME)).toBe(null);

			// Gets loaded by load
			const account = await accountManager.loadAccountByUsername(TEST_USERNAME);
			expect(account).toBeInstanceOf(Account);
			expect((account as Account).id).toBe(testAccountId);

			// Get returns loaded account
			expect(accountManager.getAccountByUsername(TEST_USERNAME)).toBe(account);
			await expect(accountManager.loadAccountByUsername(TEST_USERNAME)).resolves.toBe(account);
		});

		it('Is case insensitive', async () => {
			// Not loaded at first
			expect(accountManager.getAccountByUsername(TEST_USERNAME)).toBe(null);
			expect(accountManager.getAccountByUsername(TEST_USERNAME_DIFFERENT_CASE)).toBe(null);

			// Gets loaded by load
			const account = await accountManager.loadAccountByUsername(TEST_USERNAME_DIFFERENT_CASE);
			expect(account).toBeInstanceOf(Account);
			expect((account as Account).id).toBe(testAccountId);

			// Get returns loaded account
			expect(accountManager.getAccountByUsername(TEST_USERNAME)).toBe(account);
			expect(accountManager.getAccountByUsername(TEST_USERNAME_DIFFERENT_CASE)).toBe(account);
			await expect(accountManager.loadAccountByUsername(TEST_USERNAME)).resolves.toBe(account);
			await expect(accountManager.loadAccountByUsername(TEST_USERNAME_DIFFERENT_CASE)).resolves.toBe(account);
		});

		it('Avoids race conditions', async () => {
			// Not loaded at first
			expect(accountManager.getAccountByUsername(TEST_USERNAME)).toBe(null);

			let resume1!: () => void;
			let resume2!: () => void;

			jest.spyOn(MockDatabase.prototype, 'getAccountByUsername')
				.mockImplementationOnce((username) => new Promise((resolve) => {
					resume1 = () => {
						resolve(mockDb.getAccountByUsername(username));
					};
				}))
				.mockImplementationOnce((username) => new Promise((resolve) => {
					resume2 = () => {
						resolve(mockDb.getAccountByUsername(username));
					};
				}));

			// Try to load two at the same time
			const promise1 = accountManager.loadAccountByUsername(TEST_USERNAME);
			const promise2 = accountManager.loadAccountByUsername(TEST_USERNAME);

			// Finish both
			expect(resume1).toBeDefined();
			expect(resume2).toBeDefined();
			resume2();
			resume1();

			await promise1;
			await promise2;

			// Account is loaded after
			const account = accountManager.getAccountByUsername(TEST_USERNAME);
			expect(account).toBeInstanceOf(Account);

			// No race condition
			await expect(promise1).resolves.toBe(account);
			await expect(promise2).resolves.toBe(account);
		});
	});

	describe('Querying accounts by Email hash', () => {
		it('Doesn\'t find unknown account', async () => {
			expect(accountManager.getAccountByEmailHash('nonexistent')).toBe(null);
			await expect(accountManager.loadAccountByEmailHash('nonexistent')).resolves.toBe(null);
		});

		it('Doesn\'t look for raw email', async () => {
			expect(accountManager.getAccountByEmailHash(TEST_EMAIL)).toBe(null);
			await expect(accountManager.loadAccountByEmailHash(TEST_EMAIL)).resolves.toBe(null);
		});

		it('Loads existing account', async () => {
			// Not loaded at first
			expect(accountManager.getAccountByEmailHash(TEST_EMAIL_HASH)).toBe(null);

			// Gets loaded by load
			const account = await accountManager.loadAccountByEmailHash(TEST_EMAIL_HASH);
			expect(account).toBeInstanceOf(Account);
			expect((account as Account).id).toBe(testAccountId);

			// Get returns loaded account
			expect(accountManager.getAccountByEmailHash(TEST_EMAIL_HASH)).toBe(account);
			await expect(accountManager.loadAccountByEmailHash(TEST_EMAIL_HASH)).resolves.toBe(account);
		});

		it('Avoids race conditions', async () => {
			// Not loaded at first
			expect(accountManager.getAccountByEmailHash(TEST_EMAIL_HASH)).toBe(null);

			let resume1!: () => void;
			let resume2!: () => void;

			jest.spyOn(MockDatabase.prototype, 'getAccountByEmailHash')
				.mockImplementationOnce((emailHash) => new Promise((resolve) => {
					resume1 = () => {
						resolve(mockDb.getAccountByEmailHash(emailHash));
					};
				}))
				.mockImplementationOnce((emailHash) => new Promise((resolve) => {
					resume2 = () => {
						resolve(mockDb.getAccountByEmailHash(emailHash));
					};
				}));

			// Try to load two at the same time
			const promise1 = accountManager.loadAccountByEmailHash(TEST_EMAIL_HASH);
			const promise2 = accountManager.loadAccountByEmailHash(TEST_EMAIL_HASH);

			// Finish both
			expect(resume1).toBeDefined();
			expect(resume2).toBeDefined();
			resume2();
			resume1();

			await promise1;
			await promise2;

			// Account is loaded after
			const account = accountManager.getAccountByEmailHash(TEST_EMAIL_HASH);
			expect(account).toBeInstanceOf(Account);

			// No race condition
			await expect(promise1).resolves.toBe(account);
			await expect(promise2).resolves.toBe(account);
		});
	});

	it('Unloads inactive accounts', async () => {
		// Not loaded at first
		expect(accountManager.getAccountById(testAccountId)).toBe(null);

		// Load it
		await expect(accountManager.loadAccountById(testAccountId)).resolves.toBeInstanceOf(Account);

		// Wait for little time -> account is still loaded
		jest.advanceTimersByTime(ACCOUNT_INACTIVITY_THRESHOLD / 2);
		expect(accountManager.getAccountById(testAccountId)).toBeInstanceOf(Account);

		// Wait for long -> account got unloaded
		jest.advanceTimersByTime(ACCOUNT_INACTIVITY_THRESHOLD + ACCOUNTMANAGER_TICK_INTERVAL);
		expect(accountManager.getAccountById(testAccountId)).toBe(null);
	});
});
