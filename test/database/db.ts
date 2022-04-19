import _ from 'lodash';
import { LogLevel, SetConsoleOutput } from 'pandora-common';
import { CreateAccountData } from '../../src/account/account';
import { PandoraDatabase } from '../../src/database/databaseProvider';
import { PrehashPassword } from '../../src/database/mockDb';

let db!: PandoraDatabase;

export default function RunDbTests(initDb: () => Promise<PandoraDatabase>, closeDb: () => Promise<void>) {

	SetConsoleOutput(LogLevel.ALERT);
	jest.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
		// we shouldn't see logs above ALERT level
		expect(args).toEqual([]);
		expect(false).toBeTruthy();
	});

	beforeEach(async () => {
		db = await initDb();
	});

	afterEach(async () => {
		await closeDb();
	});

	describe('getAccountById()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountById(1)).toBeNull();
		});
	});

	describe('getAccountByUsername()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountByUsername('someone')).toBeNull();
		});
	});

	describe('getAccountByEmailHash()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountByEmailHash('some-hash')).toBeNull();
		});
	});

	describe('createAccount()', () => {

		it('creating accounts in parallel', async () => {
			const mockAccount = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');

			const [account1, account2, account3] = await Promise.all([mockAccount, mockAccount, mockAccount]
				.map((acc) => _.cloneDeep(acc))
				.map(async (account, index) => {
					account.username = `test-${index}`;
					account.secure.emailHash = `test-${index}`;
					return await db.createAccount(account) as DatabaseAccountWithSecure;
				}));

			expect(account1).toBeInstanceOf(Object);
			expect(account2).toBeInstanceOf(Object);
			expect(account3).toBeInstanceOf(Object);

			expect(account1.id).toBeGreaterThan(0);
			expect(account2.id).toBeGreaterThan(0);
			expect(account3.id).toBeGreaterThan(0);

			expect(account1.id).not.toBe(account2.id);
			expect(account1.id).not.toBe(account3.id);
			expect(account2.id).not.toBe(account3.id);
		});

		it('created account is gettable by id', async () => {
			const acc = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc) as DatabaseAccountWithSecure;
			expect(createdAcc).toBeInstanceOf(Object);
			expect(await db.getAccountById(createdAcc.id)).toEqual(createdAcc);
		});

		it('created account is gettable by username', async () => {
			const acc = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc) as DatabaseAccountWithSecure;
			expect(createdAcc).toBeInstanceOf(Object);
			expect(await db.getAccountByUsername(acc.username)).toEqual(createdAcc);
		});

		it('created account is gettable by email hash', async () => {
			const acc = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc) as DatabaseAccountWithSecure;
			expect(createdAcc).toBeInstanceOf(Object);
			expect(await db.getAccountByEmailHash(acc.secure.emailHash)).toEqual(createdAcc);
		});

		it('username must be unique', async () => {
			const mockAccount = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');
			await db.createAccount(mockAccount);

			expect(await db.createAccount(mockAccount)).toBe('usernameTaken');

			mockAccount.secure.emailHash = 'something';
			expect(await db.createAccount(mockAccount)).toBe('usernameTaken');
		});

		it('email must be unique', async () => {
			const mockAccount = await CreateAccountData('test', PrehashPassword('test'), 'test@example.com');
			await db.createAccount(mockAccount);

			mockAccount.username = 'test1';
			expect(await db.createAccount(mockAccount)).toBe('emailTaken');
		});
	});
}
