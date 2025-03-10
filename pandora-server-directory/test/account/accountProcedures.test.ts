import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Account } from '../../src/account/account.ts';
import { accountManager } from '../../src/account/accountManager.ts';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../../src/account/accountProcedures.ts';
import AccountSecure from '../../src/account/accountSecure.ts';
import { TestMockDb } from '../utils.ts';

const TEST_USERNAME = 'testuser';
const TEST_DISPLAYNAME = 'TestUserDisplay';
const TEST_EMAIL = 'test@project-pandora.com';

let testAccountId: number;

beforeAll(async () => {
	await TestMockDb();
	// Create at least one account
	const account = await accountManager.createAccount(TEST_USERNAME, TEST_DISPLAYNAME, 'test', TEST_EMAIL);
	expect(account).toBeInstanceOf(Account);
	testAccountId = (account as Account).id;
	await accountManager.onDestroyCharacters();
	accountManager.onDestroyAccounts();
});

beforeEach(() => {
	jest.useFakeTimers();
	accountManager.init();
});
afterEach(async () => {
	await accountManager.onDestroyCharacters();
	accountManager.onDestroyAccounts();
	jest.useRealTimers();
});

describe('AccountProcedurePasswordReset', () => {
	it('Calls resetPassword on existing account', async () => {
		const sendObserver = jest.spyOn(AccountSecure.prototype, 'resetPassword');

		await AccountProcedurePasswordReset(TEST_EMAIL);

		// The account should be loaded afterwards
		const account = accountManager.getAccountById(testAccountId) as Account;
		expect(account).toBeInstanceOf(Account);

		// The reset happened
		expect(sendObserver).toHaveBeenCalledTimes(1);
		expect(sendObserver).toHaveBeenNthCalledWith(1, TEST_EMAIL);
	});

	it(`Doesn't do anything if account doesn't exist`, async () => {
		const sendObserver = jest.spyOn(AccountSecure.prototype, 'resetPassword');

		await AccountProcedurePasswordReset('nonexistent@project-pandora.com');

		// Nothing was done
		expect(sendObserver).not.toHaveBeenCalled();
	});
});

describe('AccountProcedureResendVerifyEmail', () => {
	it('Calls sendActivation on existing account', async () => {
		const sendObserver = jest.spyOn(AccountSecure.prototype, 'sendActivation');

		await AccountProcedureResendVerifyEmail(TEST_EMAIL);

		// The account should be loaded afterwards
		const account = accountManager.getAccountById(testAccountId) as Account;
		expect(account).toBeInstanceOf(Account);

		// The reset happened
		expect(sendObserver).toHaveBeenCalledTimes(1);
		expect(sendObserver).toHaveBeenNthCalledWith(1, TEST_EMAIL);
	});

	it(`Doesn't do anything if account doesn't exist`, async () => {
		const sendObserver = jest.spyOn(AccountSecure.prototype, 'sendActivation');

		await AccountProcedureResendVerifyEmail('nonexistent@project-pandora.com');

		// Nothing was done
		expect(sendObserver).not.toHaveBeenCalled();
	});
});
