import { CreateDatabase, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrowError();
	});
});

describe('CreateDatabase()', () => {
	it('sets given database', async () => {
		const instance = CreateDatabase(await new MockDatabase().init());
		expect(() => GetDatabase()).not.toThrowError();
		expect(GetDatabase()).toBe(instance);
	});
});
