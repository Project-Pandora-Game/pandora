import { InitDatabase, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrowError();
	});
});

describe('InitDatabase()', () => {
	it('sets given database', async () => {
		const instance = await new MockDatabase().init();
		await InitDatabase(instance);
		expect(() => GetDatabase()).not.toThrowError();
		expect(GetDatabase()).toBe(instance);
	});
});
