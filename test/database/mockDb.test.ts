import { PandoraDatabase } from '../../src/database/databaseProvider';
import { MockDatabase, PrehashPassword } from '../../src/database/mockDb';
import { CreateAccountData } from '../../src/account/account';
import { createHash } from 'crypto';
import { PASSWORD_PREHASH_SALT } from 'pandora-common';

describe('PrehashPassword()', () => {

	it('should return a string', () => {
		expect(typeof PrehashPassword('mock')).toBe('string');
	});

	it('should return correctly salted hash', () => {
		const mockPass = 'mockpassword!2020';
		const correctHash = createHash('sha512').update(PASSWORD_PREHASH_SALT + mockPass, 'utf-8').digest('base64');
		expect(PrehashPassword(mockPass)).toBe(correctHash);
	});
});

describe('MockDatabase', () => {
	//disable console.info for this test suit
	jest.spyOn(console, 'info').mockImplementation(() => { /*empty*/ });

	let db: PandoraDatabase;
	beforeEach(async () => {
		db = await new MockDatabase().init();
	});
	describe('init()', () => {
		it('should initialize the DB and return its reference', () => {
			expect(db).toBeInstanceOf(MockDatabase);
		});
	});

	describe('getAccountById()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountById(-12312)).toBeNull();
		});

		it('should return object if found', async () => {
			expect(typeof await db.getAccountById(-1)).toBe('object');
		});
	});

	describe('getAccountByUsername()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountByUsername('meehhhhh')).toBeNull();
		});
		it('should return object if found', async () => {
			expect(typeof await db.getAccountByUsername('test')).toBe('object');
		});
	});

	describe('getAccountByEmailHash()', () => {
		it('should return null if account not found', async () => {
			expect(await db.getAccountByEmailHash('meehhhhh')).toBeNull();
		});
		it('should return object if found', async () => {
			expect(typeof await db.getAccountByEmailHash('7sjzmXgD9vvKT7nIOKJFO6PvK3xgV+5hVblDHSWwzzk=')).toBe('object');
		});
	});

	describe('createAccount()', () => {

		it('should return object if data is valid', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const mockAccount = await CreateAccountData('test2', PrehashPassword('test2'), 'test2@example.com', true);

			expect(typeof await db.createAccount(mockAccount)).toBe('object');
		});

		it('should not return object if data is invalid', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const mockAccount = await CreateAccountData('test2', PrehashPassword('test2'), 'test2@example.com', true);

			await db.createAccount(mockAccount);
			expect(typeof await db.createAccount(mockAccount)).not.toBe('object');
		});

		it('should return error string if data is invalid', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const mockAccount = await CreateAccountData('test2', PrehashPassword('test2'), 'test2@example.com', true);

			await db.createAccount(mockAccount);
			expect(typeof await db.createAccount(mockAccount)).toBe('string');
		});
	});
});
