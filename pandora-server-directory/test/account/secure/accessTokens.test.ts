import { describe, expect, it, jest } from '@jest/globals';
import { Assert, LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT, PANDORA_ACCESS_TOKEN_REGEX_FULL, PandoraAccessToken, TimeSpanMs } from 'pandora-common';
import { AccountSecureAccessTokenStore } from '../../../src/account/secure/accessTokens.ts';
import { TestMockAccount } from '../../utils.ts';

describe('AccountSecureAccessTokenStore', () => {
	it('creates and lists a token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');
		expect(token).toStrictEqual([
			expect.stringMatching(PANDORA_ACCESS_TOKEN_REGEX_FULL),
			{
				created: now,
				expires: now + expiry,
				id: expect.any(String),
				name: 'testToken',
				scopes: [
					'spaces:list_owned',
				],
				tokenHash: expect.any(String),
			},
		]);
		await expect(AccountSecureAccessTokenStore.hashToken(token[0])).resolves.toBe(token[1].tokenHash);

		expect(account.secure.accessTokens.listTokens()).toStrictEqual([
			{
				id: token[1].id,
				name: 'testToken',
				scopes: [
					'spaces:list_owned',
				],
				lastUsed: undefined,
				created: now,
				expires: now + expiry,
			},
		]);

		expect(account.secure.accessTokens.getTokenInfo('aaa')).toBeNull();
		expect(account.secure.accessTokens.getTokenInfo(token[0])).toBeNull();
		expect(account.secure.accessTokens.getTokenInfo(token[1].id)).toBeNull();

		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toStrictEqual({
			id: token[1].id,
			name: 'testToken',
			scopes: [
				'spaces:list_owned',
			],
			lastUsed: undefined,
			created: now,
			expires: now + expiry,
		});
	});

	it('verifies new token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		jest.advanceTimersByTime(100);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		// Updates last used
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: Date.now(),
		});
	});

	it('verifies valid scope', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		jest.advanceTimersByTime(100);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, ['spaces:list_owned'])).toBe('ok');

		// Updates last used
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: Date.now(),
		});
	});

	it('fails to verify invalid scope', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		jest.advanceTimersByTime(100);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, ['spaces:disown'])).toBe('missingScopes');

		// Still updates last used - the token itself was valid
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: Date.now(),
		});
	});

	it('fails to verify disabled account', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		await account.secure.adminDisableAccount({ disabledBy: 0, internalReason: 'Test', publicReason: 'Test', time: Date.now() });

		jest.advanceTimersByTime(100);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('disabledAccount');

		// Last used unchanged - token invalid
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: undefined,
		});
	});

	it('fails to verify unknown token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		jest.advanceTimersByTime(100);

		expect(account.secure.accessTokens.verifyToken('aaa', [])).toBe('invalidToken');

		// Last used unchanged - token invalid
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: undefined,
		});
	});

	it('fails to verify expired token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(expiry + 1);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('invalidToken');

		// Last used unchanged - token invalid
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toMatchObject({
			lastUsed: now,
		});
	});

	it('still lists expired tokens', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(expiry + 1);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('invalidToken');

		expect(account.secure.accessTokens.listTokens()).toStrictEqual([
			{
				id: token[1].id,
				name: 'testToken',
				scopes: [
					'spaces:list_owned',
				],
				lastUsed: now,
				created: now,
				expires: now + expiry,
			},
		]);

		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toStrictEqual({
			id: token[1].id,
			name: 'testToken',
			scopes: [
				'spaces:list_owned',
			],
			lastUsed: now,
			created: now,
			expires: now + expiry,
		});
	});

	it('regenerates token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));
		const renewNow = Date.now();
		const newExpiry = TimeSpanMs(2, 'days');

		const renewResult = await account.secure.accessTokens.regenerateToken(token[1].id, renewNow + newExpiry);
		Assert(typeof renewResult !== 'string');

		// Old verify does not work
		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('invalidToken');
		// New token works
		expect(account.secure.accessTokens.verifyToken(renewResult[1].tokenHash, [])).toBe('ok');

		// Data is updated
		expect(account.secure.accessTokens.listTokens()).toStrictEqual([
			{
				id: token[1].id,
				name: 'testToken',
				scopes: [
					'spaces:list_owned',
				],
				lastUsed: expect.any(Number),
				created: now, // Created is unchanged
				expires: renewNow + newExpiry,
			},
		]);

		// Old get returns nothing
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toBeNull();
		// New get returns results
		expect(account.secure.accessTokens.getTokenInfo(renewResult[1].tokenHash)).toStrictEqual({
			id: token[1].id,
			name: 'testToken',
			scopes: [
				'spaces:list_owned',
			],
			lastUsed: expect.any(Number),
			created: now,
			expires: renewNow + newExpiry,
		});
	});

	it('fails to regenerate unknown token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));
		const renewNow = Date.now();
		const newExpiry = TimeSpanMs(2, 'days');

		const renewResult = await account.secure.accessTokens.regenerateToken('aaa', renewNow + newExpiry);
		expect(renewResult).toBe('notFound');
	});

	it('deletes token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));

		await expect(account.secure.accessTokens.deleteToken(token[1].id)).resolves.toBe(true);

		// Old verify does not work
		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('invalidToken');

		// Data is removed
		expect(account.secure.accessTokens.listTokens()).toHaveLength(0);
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toBeNull();
	});

	it('fails to delete unknown token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');
		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));

		await expect(account.secure.accessTokens.deleteToken('aaa')).resolves.toBe(false);

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');
	});

	it('updates token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));

		await expect(account.secure.accessTokens.updateToken(token[1].id, 'newTestToken', ['spaces:disown'])).resolves.toBe(true);

		// Old verify still works
		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');
		// Old scope does not work
		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, ['spaces:list_owned'])).toBe('missingScopes');
		// New scope does work
		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, ['spaces:disown'])).toBe('ok');

		// Data is updated
		expect(account.secure.accessTokens.listTokens()).toStrictEqual([
			{
				id: token[1].id,
				name: 'newTestToken',
				scopes: [
					'spaces:disown',
				],
				lastUsed: expect.any(Number),
				created: now, // Created is unchanged
				expires: now + expiry,
			},
		]);
		expect(account.secure.accessTokens.getTokenInfo(token[1].tokenHash)).toStrictEqual({
			id: token[1].id,
			name: 'newTestToken',
			scopes: [
				'spaces:disown',
			],
			lastUsed: expect.any(Number),
			created: now, // Created is unchanged
			expires: now + expiry,
		});
	});

	it('update fails on unknown token', async () => {
		const account = await TestMockAccount();

		jest.useFakeTimers();

		const now = Date.now();
		const expiry = TimeSpanMs(1, 'days');

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], now + expiry);
		Assert(typeof token !== 'string');

		expect(account.secure.accessTokens.verifyToken(token[1].tokenHash, [])).toBe('ok');

		jest.advanceTimersByTime(TimeSpanMs(1, 'hours'));

		await expect(account.secure.accessTokens.updateToken('aaa', 'newTestToken', ['spaces:disown'])).resolves.toBe(false);
	});

	it('create limits count', async () => {
		expect(LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT).toBeGreaterThan(1);

		const account = await TestMockAccount();

		jest.useFakeTimers();

		const seenTokens = new Set<PandoraAccessToken>();
		for (let i = 0; i < LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT; i++) {
			const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], Date.now() + TimeSpanMs(1, 'days'));
			Assert(typeof token !== 'string');

			expect(seenTokens.has(token[0])).toBe(false);
			seenTokens.add(token[0]);

			jest.advanceTimersByTime(1000);
		}

		const tooManyResult = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], Date.now() + TimeSpanMs(1, 'days'));
		expect(tooManyResult).toBe('limitReached');

		expect(account.secure.accessTokens.listTokens()).toHaveLength(LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT);
	});

	it('create protects against unicorns', async () => {
		expect(LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT).toBeGreaterThan(1);

		const account = await TestMockAccount();

		jest.useFakeTimers();

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], Date.now() + TimeSpanMs(1, 'days'));
		Assert(typeof token !== 'string');

		// "Randomly" generate exact same token
		const mock = jest.spyOn(AccountSecureAccessTokenStore, '_generateRandomToken');
		mock.mockReturnValue(token[0]);

		await expect(
			account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], Date.now() + TimeSpanMs(1, 'days')),
		).rejects.toThrowErrorMatchingInlineSnapshot(`"Encountered a unicorn! (generated duplicate access token)"`);

		mock.mockRestore();
	});

	it('regenerate protects against unicorns', async () => {
		expect(LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT).toBeGreaterThan(1);

		const account = await TestMockAccount();

		jest.useFakeTimers();

		const token = await account.secure.accessTokens.createToken('testToken', ['spaces:list_owned'], Date.now() + TimeSpanMs(1, 'days'));
		Assert(typeof token !== 'string');

		// "Randomly" generate exact same token
		const mock = jest.spyOn(AccountSecureAccessTokenStore, '_generateRandomToken');
		mock.mockReturnValue(token[0]);

		await expect(
			account.secure.accessTokens.regenerateToken(token[1].id, Date.now() + TimeSpanMs(1, 'days')),
		).rejects.toThrowErrorMatchingInlineSnapshot(`"Encountered a unicorn! (generated duplicate access token)"`);

		mock.mockRestore();
	});
});
