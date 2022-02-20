import { InitDatabase, GetDatabase } from '../../src/database/databaseProvider';
import { MockDatabase } from '../../src/database/mockDb';

describe('GetDatabase()', () => {
	it('should throw error if DB is not initialized', () => {
		expect(() => GetDatabase()).toThrowError();
	});
});

describe('InitDatabse()', () => {
	//disable console.info for this test suit
	jest.spyOn(console, 'info').mockImplementation(() => { /*empty*/ });

	it('should initialze async the database', async () => {
		await InitDatabase();
		expect(() => GetDatabase()).not.toThrowError();
		expect(GetDatabase()).toBeInstanceOf(MockDatabase);
	});
});
