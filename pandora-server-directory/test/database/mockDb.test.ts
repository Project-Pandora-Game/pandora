import { MockDatabase, PrehashPassword } from '../../src/database/mockDb';
import { createHash } from 'crypto';
import { PASSWORD_PREHASH_SALT } from 'pandora-common';
import RunDbTests from './db';

describe('PrehashPassword()', () => {

	it('should return a string', () => {
		expect(typeof PrehashPassword('mock')).toBe('string');
	});

	it('should return correctly salted hash', () => {
		const mockPass = 'mockpassword!2020';
		const correctHash = createHash('sha512').update(PASSWORD_PREHASH_SALT + mockPass, 'utf-8').digest('base64');
		expect(PrehashPassword(mockPass)).toBe(correctHash);
	});
});

describe('MockDatabase', () => {
	RunDbTests(() => new MockDatabase({ addTestAccounts: false }).init(), () => Promise.resolve());

	it('Inits with mock accounts', async () => {
		await new MockDatabase().init();
	});
});
