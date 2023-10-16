import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { CreateAccountData } from '../../src/account/account';
import { PrehashPassword } from '../../src/database/mockDb';
import MongoDatabase, { MONGODB_SERVER_VERSION } from '../../src/database/mongoDb';
import RunDbTests from './db';

// @jest

let db: MongoDatabase | null = null;

describe('MongoDatabase', () => {
	RunDbTests(async () => {
		db = null;
		db = await new MongoDatabase({ inMemory: true }).init();
		return db;
	}, async () => {
		if (db) {
			await db.onDestroy();
		}
	});
});

describe('MongoDatabase extra tests', () => {
	let server: MongoMemoryServer;
	beforeEach(async () => {
		server = await MongoMemoryServer.create({
			binary: {
				version: MONGODB_SERVER_VERSION,
				checkMD5: false,
			},
		});
	});
	afterEach(async () => {
		await server.stop();
	});

	it('Can connect to normal MongoDB', async () => {
		const testDb = await new MongoDatabase({ url: server.getUri() }).init();
		await testDb.onDestroy();
	});

	it('fails on double init', async () => {
		const testDb = await new MongoDatabase({ url: server.getUri() }).init();

		await expect(testDb.init()).rejects.toThrowError('Database already initialized');

		await testDb.onDestroy();
	});

	it('Correctly finds id after reconnect', async () => {
		const testDb = await new MongoDatabase({ url: server.getUri() }).init();

		const acc = await testDb.createAccount(await CreateAccountData('testuser1', PrehashPassword('password1'), 'test1@project-pandora.com')) as DatabaseAccountWithSecure;
		const char = await testDb.createCharacter(acc.id);

		await testDb.onDestroy();

		const testDb2 = await new MongoDatabase({ url: server.getUri() }).init();

		const acc2 = await testDb2.createAccount(await CreateAccountData('testuser2', PrehashPassword('password2'), 'test2@project-pandora.com')) as DatabaseAccountWithSecure;
		const char2 = await testDb2.createCharacter(acc.id);

		expect(acc2.id).not.toBe(acc.id);
		expect(char2.id).not.toBe(char.id);

		await testDb2.onDestroy();
	});
});
