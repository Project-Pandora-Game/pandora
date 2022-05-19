import { MongoMemoryServer } from 'mongodb-memory-server';
import { CreateAccountData } from '../../src/account/account';
import { PrehashPassword } from '../../src/database/mockDb';
import MongoDatabase from '../../src/database/mongoDb';
import RunDbTests from './db';

// @jest

let db: MongoDatabase | null = null;

describe('MongoDatabase', () => {
	RunDbTests(async () => {
		db = null;
		// Wait up to a minute; the MongoDB server might need to be downloaded
		jest.setTimeout(60_000);
		db = await new MongoDatabase().init({ inMemory: true });
		return db;
	}, async () => {
		if (db) {
			await db.close();
		}
	});
});

describe('MongoDatabase extra tests', () => {
	let server: MongoMemoryServer;
	beforeEach(async () => {
		server = await MongoMemoryServer.create({
			binary: {
				version: '5.0.6',
				checkMD5: false,
			},
		});
	});
	afterEach(async () => {
		await server.stop();
	});

	it('Can connect to normal MongoDB', async () => {
		const testDb = await new MongoDatabase(server.getUri()).init();
		await testDb.close();
	});

	it('fails on double init', async () => {
		const testDb = await new MongoDatabase(server.getUri()).init();

		await expect(testDb.init()).rejects.toThrowError('Database already initialized');

		await testDb.close();
	});

	it('Correctly finds id after reconnect', async () => {
		const testDb = await new MongoDatabase(server.getUri()).init();

		const acc = await testDb.createAccount(await CreateAccountData('testuser1', PrehashPassword('password1'), 'test1@project-pandora.com')) as DatabaseAccountWithSecure;
		const char = await testDb.createCharacter(acc.id);

		await testDb.close();

		const testDb2 = await new MongoDatabase(server.getUri()).init();

		const acc2 = await testDb2.createAccount(await CreateAccountData('testuser2', PrehashPassword('password2'), 'test2@project-pandora.com')) as DatabaseAccountWithSecure;
		const char2 = await testDb2.createCharacter(acc.id);

		expect(acc2.id).not.toBe(acc.id);
		expect(char2.id).not.toBe(char.id);

		await testDb2.close();
	});
});
