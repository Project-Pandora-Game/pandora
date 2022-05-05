/* eslint-disable @typescript-eslint/ban-ts-comment */
import MongoDatabase from '../../src/database/mongoDb';
import RunDbTests from './db';

// @jest

let db: MongoDatabase | null = null;

describe('MongoDatabase', () => {
	RunDbTests(async () => {
		db = null;
		db = await new MongoDatabase().init({ inMemory: true });
		return db;
	}, async () => {
		if (db) {
			// @ts-expect-error
			await db._client.close();
			// @ts-expect-error
			await db._inMemoryServer?.stop();
		}
	});
});
