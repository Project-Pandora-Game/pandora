import { describe, expect, it } from '@jest/globals';
import { GetDatabase, InitDatabaseForTests } from '../../src/database/databaseProvider.ts';
import { MockDatabase } from '../../src/database/mockDb.ts';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrow();
	});
});

describe('InitDatabaseForTests()', () => {
	it('sets given database', async () => {
		const instance = new MockDatabase();
		await InitDatabaseForTests(instance);
		expect(() => GetDatabase()).not.toThrow();
		expect(GetDatabase()).toBe(instance);
	});
});
