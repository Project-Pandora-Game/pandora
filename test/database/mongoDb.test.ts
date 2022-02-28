/* eslint-disable @typescript-eslint/ban-ts-comment */
import MongoDatabase from '../../src/database/mongoDb';
import RunDbTests from './db';

let db: MongoDatabase | null = null;

describe('MongoDatabase', () => {
	RunDbTests(async () => {
		db = null;
		// @ts-expect-error
		db = await new MongoDatabase(global.__MONGO_URI__ as string).init();

		// @ts-expect-error
		if (await db._accounts.countDocuments() !== 0) {
			db = null;
			expect(true).toBe(false);
		}

		return db as MongoDatabase;
	}, async () => {
		if (db) {
			// @ts-expect-error
			await db._accounts.deleteMany({});
			// @ts-expect-error
			await db._client.close();
		}
	});
});
