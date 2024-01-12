import { InitDatabase, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrow();
	});
});

describe('InitDatabase()', () => {
	it('sets given database', async () => {
		const instance = new MockDatabase();
		await InitDatabase(instance);
		expect(() => GetDatabase()).not.toThrow();
		expect(GetDatabase()).toBe(instance);
	});
});
