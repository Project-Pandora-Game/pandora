import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { cloneDeep, pick } from 'lodash-es';
import { Assert, AssertNotNullable, logConfig, LogLevel } from 'pandora-common';
import { CreateAccountData } from '../../src/account/account.ts';
import { GenerateAccountSecureData, GenerateEmailHash } from '../../src/account/accountSecure.ts';
import { PandoraDatabase } from '../../src/database/databaseProvider.ts';
import { PrehashPassword } from '../../src/database/mockDb.ts';
import { TEST_SPACE, TEST_SPACE2, TEST_SPACE_DEV, TEST_SPACE_PANDORA_OWNED } from '../spaces/testData.ts';

const TEST_USERNAME1 = 'testuser1';
const TEST_EMAIL1 = 'test1@project-pandora.com';
const TEST_PASSWORD1 = PrehashPassword('password1');

const TEST_USERNAME2 = 'testuser2';
const TEST_EMAIL2 = 'test2@project-pandora.com';
const TEST_PASSWORD2 = PrehashPassword('password2');

export default function RunDbTests(initDb: () => Promise<PandoraDatabase>, closeDb: () => Promise<void>) {
	let db!: PandoraDatabase;
	let accountId1: number;
	let accountId2: number;

	beforeAll(() => {
		// we shouldn't see logs above ALERT level
		logConfig.logOutputs.push({
			logLevel: LogLevel.WARNING,
			logLevelOverrides: {},
			supportsColor: false,
			onMessage(...args) {
				// eslint-disable-next-line no-console
				console.error(...args);
				throw new Error('Got message above alert');
			},
		});
	});

	beforeEach(async () => {
		db = await initDb();
		// Create test accounts
		const result1 = await db.createAccount(await CreateAccountData(TEST_USERNAME1, TEST_USERNAME1, TEST_PASSWORD1, TEST_EMAIL1));
		const result2 = await db.createAccount(await CreateAccountData(TEST_USERNAME2, TEST_USERNAME2, TEST_PASSWORD2, TEST_EMAIL2, true));
		if (typeof result1 === 'string') {
			throw new Error(result1);
		}
		if (typeof result2 === 'string') {
			throw new Error(result2);
		}
		accountId1 = result1.id;
		accountId2 = result2.id;

		expect(accountId1).not.toBe(accountId2);
		// Wait up to a minute; the MongoDB server might need to be downloaded
	}, 60_000);

	afterEach(async () => {
		await closeDb();
	});

	describe('getAccountById()', () => {
		it('returns null if account not found', async () => {
			expect(await db.getAccountById(999)).toBeNull();
		});

		it('returns account data of known accounts', async () => {
			const result1 = await db.getAccountById(accountId1);
			expect(result1).not.toBeNull();
			expect(result1?.id).toBe(accountId1);
			expect(result1?.username).toBe(TEST_USERNAME1);

			const result2 = await db.getAccountById(accountId2);
			expect(result2).not.toBeNull();
			expect(result2?.id).toBe(accountId2);
			expect(result2?.username).toBe(TEST_USERNAME2);
		});
	});

	describe('getAccountByUsername()', () => {
		it('returns null if account not found', async () => {
			expect(await db.getAccountByUsername('nonexistent')).toBeNull();
		});

		it.each([
			[TEST_USERNAME1, () => accountId1],
			[TEST_USERNAME2, () => accountId2],
		])('returns account data of known accounts', async (username, idGetter) => {
			const id = idGetter();

			const result = await db.getAccountByUsername(username);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(id);
			expect(result?.username).toBe(username);
		});

		it.each([
			[TEST_USERNAME1],
			[TEST_USERNAME2],
		])('is case insensitive', async (username) => {
			const usernameVariant = username.toUpperCase();
			expect(usernameVariant).not.toEqual(username);

			const result = await db.getAccountByUsername(usernameVariant);
			expect(result).not.toBeNull();
			expect(result?.username).not.toBe(usernameVariant);
			expect(result?.username.toLowerCase()).toBe(usernameVariant.toLowerCase());
			expect(result?.username).toBe(username);
		});
	});

	describe('getAccountByEmailHash()', () => {
		it('returns null if account not found', async () => {
			expect(await db.getAccountByEmailHash(GenerateEmailHash('nonexistent@project-pandora.com'))).toBeNull();
		});

		it('returns null if querying by email', async () => {
			expect(await db.getAccountByEmailHash(TEST_EMAIL1)).toBeNull();
			expect(await db.getAccountByEmailHash(TEST_EMAIL2)).toBeNull();
		});

		it('returns account data of known accounts', async () => {
			const hash1 = GenerateEmailHash(TEST_EMAIL1);
			const result1 = await db.getAccountByEmailHash(hash1);
			expect(result1).not.toBeNull();
			expect(result1?.id).toBe(accountId1);
			expect(result1?.username).toBe(TEST_USERNAME1);

			const hash2 = GenerateEmailHash(TEST_EMAIL2);
			const result2 = await db.getAccountByEmailHash(hash2);
			expect(result2).not.toBeNull();
			expect(result2?.id).toBe(accountId2);
			expect(result2?.username).toBe(TEST_USERNAME2);
		});
	});

	describe('createAccount()', () => {

		it('creates accounts in parallel', async () => {
			const mockAccount = await CreateAccountData('test', 'test', PrehashPassword('test'), 'test@example.com');

			const [account1, account2, account3] = await Promise.all([mockAccount, mockAccount, mockAccount]
				.map((acc) => cloneDeep(acc))
				.map(async (account, index) => {
					account.username = `test-${index}`;
					account.secure.emailHash = `test-${index}`;
					const result = await db.createAccount(account);
					Assert(typeof result !== 'string');
					return result;
				}));

			expect(account1).toBeInstanceOf(Object);
			expect(account2).toBeInstanceOf(Object);
			expect(account3).toBeInstanceOf(Object);

			expect(account1.id).toBeGreaterThan(0);
			expect(account2.id).toBeGreaterThan(0);
			expect(account3.id).toBeGreaterThan(0);

			expect(account1.id).not.toBe(account2.id);
			expect(account1.id).not.toBe(account3.id);
			expect(account2.id).not.toBe(account3.id);
		});

		it('creates account with gettable id', async () => {
			const acc = await CreateAccountData('test', 'test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc);
			expect(createdAcc).toBeInstanceOf(Object);
			Assert(typeof createdAcc !== 'string');
			expect(await db.getAccountById(createdAcc.id)).toEqual(createdAcc);
		});

		it('creates account with gettable username', async () => {
			const acc = await CreateAccountData('test', 'test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc);
			expect(createdAcc).toBeInstanceOf(Object);
			Assert(typeof createdAcc !== 'string');
			expect(await db.getAccountByUsername(acc.username)).toEqual(createdAcc);
		});

		it('creates account with gettable email hash', async () => {
			const acc = await CreateAccountData('test', 'test', PrehashPassword('test'), 'test@example.com');
			const createdAcc = await db.createAccount(acc);
			expect(createdAcc).toBeInstanceOf(Object);
			Assert(typeof createdAcc !== 'string');
			expect(await db.getAccountByEmailHash(acc.secure.emailHash)).toEqual(createdAcc);
		});

		it('rejects creating account with duplicate username', async () => {
			const mockAccount = await CreateAccountData(TEST_USERNAME1, TEST_USERNAME1, TEST_PASSWORD1, 'nonexistent@project-pandora.com');

			await expect(db.createAccount(mockAccount)).resolves.toBe('usernameTaken');
		});

		it('rejects creating account with duplicate username (case insensitive)', async () => {
			const anotherUsername = TEST_USERNAME1.toUpperCase();
			expect(anotherUsername).not.toEqual(TEST_USERNAME1);
			const mockAccount = await CreateAccountData(anotherUsername, anotherUsername, TEST_PASSWORD1, 'nonexistent@project-pandora.com');

			await expect(db.createAccount(mockAccount)).resolves.toBe('usernameTaken');
		});

		it('rejects creating account with duplicate email', async () => {
			const mockAccount = await CreateAccountData('nonexistent', 'nonexistent', TEST_PASSWORD1, TEST_EMAIL1);

			await expect(db.createAccount(mockAccount)).resolves.toBe('emailTaken');
		});

		it('reports duplicate username over email', async () => {
			const mockAccount = await CreateAccountData(TEST_USERNAME1, TEST_USERNAME1, TEST_PASSWORD1, TEST_EMAIL1);

			await expect(db.createAccount(mockAccount)).resolves.toBe('usernameTaken');
		});
	});

	describe('setAccountSecure()', () => {
		it('sets secure data of existing accout', async () => {
			const account1Original = await db.getAccountById(accountId1);
			const account2Original = await db.getAccountById(accountId2);

			const newSecure = await GenerateAccountSecureData('new pass', 'newEmail@project-pandora.com');

			await db.setAccountSecure(accountId1, newSecure);

			const account1New = await db.getAccountById(accountId1);
			const account2New = await db.getAccountById(accountId2);

			// No references
			expect(account1Original).not.toBe(account1New);
			expect(account2Original).not.toBe(account2New);
			expect(account1New?.secure).not.toBe(newSecure);

			// Original replaced
			expect(account1New?.secure).toStrictEqual(newSecure);

			// Other account unaffected
			expect(account2New?.secure).toStrictEqual(account2Original?.secure);
			expect(account2New?.secure).not.toEqual(newSecure);
		});

		it('does nothing with unknown account', async () => {
			const account1Original = await db.getAccountById(accountId1);

			const newSecure = await GenerateAccountSecureData('new pass', 'newEmail@project-pandora.com');

			await db.setAccountSecure(999, newSecure);

			const account1New = await db.getAccountById(accountId1);

			// Account unaffected
			expect(account1New?.secure).toStrictEqual(account1Original?.secure);
			expect(account1New?.secure).not.toEqual(newSecure);
		});
	});

	describe('createCharacter()', () => {
		it('creates new character on existing account', async () => {
			const result = await db.createCharacter(accountId1);

			// New character is in process of creation
			expect(result.inCreation).toBe(true);

			// Exists in character database
			const characterData = await db.getCharacter(result.id, false);
			// With correct data
			expect(characterData).not.toBeNull();
			expect(characterData?.accountId).toBe(accountId1);
			expect(characterData?.id).toBe(result.id);
		});

		it('fails on unknown account', async () => {
			await expect(db.createCharacter(999)).rejects.toThrow('Account not found');
		});
	});

	describe('getCharactersForAccount()', () => {
		it('Returns empty for unknown account', async () => {
			const result = await db.getCharactersForAccount(999);

			expect(result).toStrictEqual([]);
		});

		it('Returns characters of specified account', async () => {
			const char1 = await db.createCharacter(accountId2);
			const char2 = await db.createCharacter(accountId2);
			await db.createCharacter(accountId1);

			const result = await db.getCharactersForAccount(accountId2);
			expect(result).toStrictEqual([
				char1,
				char2,
			]);
		});
	});

	describe('finalizeCharacter()', () => {
		it('fails on unknown account', async () => {
			await expect(db.finalizeCharacter(999, 'c0')).resolves.toBeNull();
		});

		it('fails on unknown character', async () => {
			await expect(db.finalizeCharacter(accountId1, 'c-1')).resolves.toBeNull();
		});

		it('finalizes character and fails on second finalize', async () => {
			const char = await db.createCharacter(accountId2);

			// Character is in creation after creation
			const characterData1 = await db.getCharacter(char.id, false);
			expect(characterData1?.inCreation).toBe(true);

			const result = await db.finalizeCharacter(accountId2, char.id);
			expect(result).not.toBeNull();

			// Character not in creation after finalize
			const characterData2 = await db.getCharacter(char.id, false);
			expect(characterData2?.inCreation).toBeUndefined();

			// Returns the data
			expect(result).not.toBe(characterData2);
			expect(result).toStrictEqual(pick(characterData2, ['id', 'name', 'created']));

			// Fails on second finalize
			await expect(db.finalizeCharacter(accountId2, char.id)).resolves.toBeNull();
		});
	});

	describe('updateCharacter()', () => {
		it('sets character data', async () => {
			const char1 = await db.createCharacter(accountId2);
			const data = (await db.getCharacter(char1.id, false))!;

			await expect(
				db.updateCharacter(char1.id, {
					name: 'test name',
				}, data.accessId),
			).resolves.toBe(true);

			const data2 = await db.getCharacter(char1.id, data.accessId);
			expect(data2).not.toBeNull();
			expect(data2).toStrictEqual({
				...data,
				name: 'test name',
			});
		});

		it('fails with unknown character', async () => {
			const char1 = await db.createCharacter(accountId2);
			const data = (await db.getCharacter(char1.id, false))!;

			await expect(
				db.updateCharacter('c999', {
					name: 'test name',
				}, null),
			).resolves.toBe(false);

			const data2 = await db.getCharacter(char1.id, data.accessId);
			expect(data2).not.toBeNull();
			expect(data2).toStrictEqual(data);
		});

		it('fails with invaid accessId', async () => {
			const char1 = await db.createCharacter(accountId2);
			const data = (await db.getCharacter(char1.id, false))!;

			await expect(
				db.updateCharacter(char1.id, {
					name: 'test name',
				}, 'not-valid-access'),
			).resolves.toBe(false);

			const data2 = await db.getCharacter(char1.id, data.accessId);
			expect(data2).not.toBeNull();
			expect(data2).toStrictEqual(data);
		});

		it('ignores accessId if not specified', async () => {
			const char1 = await db.createCharacter(accountId2);
			const data = (await db.getCharacter(char1.id, false))!;

			await expect(
				db.updateCharacter(char1.id, {
					name: 'test name',
				}, null),
			).resolves.toBe(true);

			const data2 = await db.getCharacter(char1.id, data.accessId);
			expect(data2).not.toBeNull();
			expect(data2).toStrictEqual({
				...data,
				name: 'test name',
			});
		});
	});

	describe('deleteCharacter()', () => {
		it('deletes correct character', async () => {
			const char1 = await db.createCharacter(accountId2);
			const char2 = await db.createCharacter(accountId2);
			const char3 = await db.createCharacter(accountId1);

			await expect(db.deleteCharacter(accountId2, char1.id)).resolves.toBeUndefined();

			await expect(db.getCharacter(char1.id, false)).resolves.toBeNull();
			await expect(db.getCharacter(char2.id, false)).resolves.not.toBeNull();
			await expect(db.getCharacter(char3.id, false)).resolves.not.toBeNull();
		});

		it('ignored with unknown account', async () => {
			const char1 = await db.createCharacter(accountId2);
			const char2 = await db.createCharacter(accountId1);

			await expect(db.deleteCharacter(999, char1.id)).resolves.toBeUndefined();

			await expect(db.getCharacter(char1.id, false)).resolves.not.toBeNull();
			await expect(db.getCharacter(char2.id, false)).resolves.not.toBeNull();
		});

		it('ignored with wrong account', async () => {
			const char1 = await db.createCharacter(accountId2);
			const char2 = await db.createCharacter(accountId1);

			// Note character originates from different account
			await expect(db.deleteCharacter(accountId1, char1.id)).resolves.toBeUndefined();

			await expect(db.getCharacter(char1.id, false)).resolves.not.toBeNull();
			await expect(db.getCharacter(char2.id, false)).resolves.not.toBeNull();
		});
	});

	describe('setCharacterAccess()', () => {
		it('generates new access id for character', async () => {
			const char1 = await db.createCharacter(accountId2);

			const result = await db.setCharacterAccess(char1.id);
			expect(result).not.toBeNull();

			await expect(db.getCharacter(char1.id, result!)).resolves.not.toBeNull();
		});

		it('invalidates old access id for character', async () => {
			const char1 = await db.createCharacter(accountId2);

			const result = await db.setCharacterAccess(char1.id);
			expect(result).not.toBeNull();

			const result2 = await db.setCharacterAccess(char1.id);
			expect(result2).not.toBeNull();

			await expect(db.getCharacter(char1.id, result!)).resolves.toBeNull();
			await expect(db.getCharacter(char1.id, result2!)).resolves.not.toBeNull();
		});

		it('fails with unknown character', async () => {
			const char1 = await db.createCharacter(accountId2);

			const result = await db.setCharacterAccess(char1.id);
			expect(result).not.toBeNull();

			// Wrong id fails
			await expect(db.setCharacterAccess('c999')).resolves.toBeNull();

			// Old character not affected
			await expect(db.getCharacter(char1.id, result!)).resolves.not.toBeNull();
		});
	});

	describe('createSpace()', () => {
		it.each([TEST_SPACE, TEST_SPACE2, TEST_SPACE_DEV])('creates new space', async (config) => {
			const result = await db.createSpace({
				config,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			// Correct result
			expect(result.config).toEqual(config);
			expect(result.owners).toEqual(TEST_SPACE_PANDORA_OWNED);

			// Exists in character database
			const spaceData = await db.getSpaceById(result.id, null);
			// With correct data
			expect(spaceData).not.toBeNull();
			Assert(spaceData != null);
			expect(spaceData.config).toEqual(config);
		});

		it('fails if ids would have a collision', async () => {
			const result1 = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			}, 's/id1');

			// Correct result
			expect(result1.config).toEqual(TEST_SPACE);
			expect(result1.owners).toEqual(TEST_SPACE_PANDORA_OWNED);
			expect(result1.id).toEqual('s/id1');

			// Fails to make space with same id
			await expect(db.createSpace({
				config: TEST_SPACE2,
				owners: [0],
			}, 's/id1')).rejects.toEqual(expect.anything());
		});
	});

	describe('updateSpace()', () => {
		it('updates chat space info', async () => {
			// Test data assertion
			expect(TEST_SPACE).not.toEqual(TEST_SPACE2);

			const space = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			await db.updateSpace(space.id, {
				config: TEST_SPACE2,
			}, null);

			// Database has new data
			const newData = await db.getSpaceById(space.id, null);
			expect(newData).not.toBeNull();
			Assert(newData != null);
			expect(newData).not.toBe(space);
			expect(newData).toEqual({
				...space,
				config: TEST_SPACE2,
			});
		});
	});

	describe('deleteSpace()', () => {
		it('deletes correct space', async () => {
			const room = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			await expect(db.getSpaceById(room.id, null)).resolves.not.toBeNull();

			await db.deleteSpace(room.id);

			await expect(db.getSpaceById(room.id, null)).resolves.toBeNull();
		});
	});

	describe('setSpaceAccessId()', () => {
		it('generates new access id for a space', async () => {
			const space = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			const result = await db.setSpaceAccessId(space.id);
			expect(result).not.toBeNull();
			AssertNotNullable(result);

			await expect(db.getSpaceById(space.id, result)).resolves.not.toBeNull();
		});

		it('invalidates old access id for a space', async () => {
			const space = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			const result = await db.setSpaceAccessId(space.id);
			expect(result).not.toBeNull();

			const result2 = await db.setSpaceAccessId(space.id);
			expect(result2).not.toBeNull();
			AssertNotNullable(result2);

			await expect(db.getSpaceById(space.id, result)).resolves.toBeNull();
			await expect(db.getSpaceById(space.id, result2)).resolves.not.toBeNull();
		});

		it('fails with unknown space', async () => {
			const space = await db.createSpace({
				config: TEST_SPACE,
				owners: TEST_SPACE_PANDORA_OWNED.slice(),
			});

			const result = await db.setSpaceAccessId(space.id);
			expect(result).not.toBeNull();

			// Wrong id fails
			await expect(db.setSpaceAccessId('s/invalid')).resolves.toBeNull();

			// Old space not affected
			await expect(db.getSpaceById(space.id, result)).resolves.not.toBeNull();
		});
	});

	describe('getCharacter()', () => {
		it('gets character info with valid accessId', async () => {
			const char1 = await db.createCharacter(accountId2);
			const accessId = await db.setCharacterAccess(char1.id);

			const result = await db.getCharacter(char1.id, accessId!);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(char1.id);
			expect(result?.accountId).toBe(accountId2);
			expect(result?.accessId).toBe(accessId);
		});

		it('fails with unknown character', async () => {
			const char1 = await db.createCharacter(accountId2);
			const accessId = await db.setCharacterAccess(char1.id);

			await expect(db.getCharacter('c999', false)).resolves.toBeNull();
			await expect(db.getCharacter('c999', 'not-valid-access')).resolves.toBeNull();
			await expect(db.getCharacter('c999', accessId!)).resolves.toBeNull();
		});

		it('fails with invaid accessId', async () => {
			const char1 = await db.createCharacter(accountId2);
			const accessId = await db.setCharacterAccess(char1.id);

			await expect(db.getCharacter(char1.id, 'not-valid-access')).resolves.toBeNull();

			// Check valid
			const result = await db.getCharacter(char1.id, accessId!);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(char1.id);
			expect(result?.accountId).toBe(accountId2);
			expect(result?.accessId).toBe(accessId);
		});

		it('sets new accessId with false', async () => {
			const char1 = await db.createCharacter(accountId2);
			const accessId = await db.setCharacterAccess(char1.id);

			const result = await db.getCharacter(char1.id, false);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(char1.id);
			expect(result?.accountId).toBe(accountId2);
			expect(result?.accessId).not.toBe(accessId);

			await expect(db.getCharacter(char1.id, result!.accessId)).resolves.not.toBeNull();
		});
	});
}
