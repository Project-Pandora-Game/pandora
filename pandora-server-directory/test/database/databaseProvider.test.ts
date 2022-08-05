import { InitDatabase, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';
import { TestSetupLogging } from '../utils';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrowError();
	});
});

describe('InitDatabase()', () => {
	beforeAll(() => {
		TestSetupLogging();
	});

	it('inits mock database', async () => {
		await InitDatabase();
		expect(() => GetDatabase()).not.toThrowError();
		expect(GetDatabase()).toBeInstanceOf(MockDatabase);
	});
});
