import { LogLevel, SetConsoleOutput } from 'pandora-common';
import { MockDatabase } from '../../src/database/mockDb';
import * as databaseProvider from '../../src/database/databaseProvider';
import { Account } from '../../src/account/account';
import AccountSecure from '../../src/account/accountSecure';
import { accountManager } from '../../src/account/accountManager';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../../src/account/accountProcedures';

const TEST_USERNAME = 'testuser';
const TEST_EMAIL = 'test@project-pandora.com';

let mockDb: MockDatabase;
let testAccountId: number;

beforeAll(async () => {
	SetConsoleOutput(LogLevel.FATAL);
	mockDb = await new MockDatabase().init(false);
	jest.spyOn(databaseProvider, 'GetDatabase').mockReturnValue(mockDb);
	// Create at least one account
	const account = await accountManager.createAccount(TEST_USERNAME, 'test', TEST_EMAIL);
	expect(account).toBeInstanceOf(Account);
	testAccountId = (account as Account).id;
	accountManager.onDestroy();
});

beforeEach(() => {
	jest.useFakeTimers();
	accountManager.init();
});
afterEach(() => {
	accountManager.onDestroy();
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
