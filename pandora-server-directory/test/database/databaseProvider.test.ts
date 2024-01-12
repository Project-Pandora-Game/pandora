import { InitDatabaseForTests, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrowError();
	});
});

describe('InitDatabaseForTests()', () => {
	it('sets given database', async () => {
		const instance = new MockDatabase();
		await InitDatabaseForTests(instance);
		expect(() => GetDatabase()).not.toThrowError();
		expect(GetDatabase()).toBe(instance);
	});
});
