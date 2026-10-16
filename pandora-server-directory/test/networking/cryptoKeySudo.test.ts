import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { generateKeyPairSync } from 'crypto';
import { MockConnection, MockServerSocket } from 'pandora-common';
import type { IClientDirectory, IDirectoryClient } from 'pandora-common/networking/api/directory_client';
import { PrehashPassword } from '../../src/database/mockDb.ts';
import { ClientConnection } from '../../src/networking/connection_client.ts';
import { TestMockAccount, TestMockDb } from '../utils.ts';

const ORIGINAL_KEY = {
	publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWDmwBlEMYi3nu7FsotmBDrHxxaX6rW8SaDQZkXPIAaofK4ZVD01Yac5yrMtX3/dWA8c720sGWQhhyyRkeEBB9Q==',
	salt: 'YWNjb3VudC1zYWx0',
	iv: 'YWNjb3VudC1pdg==',
	encryptedPrivateKey: 'YWNjb3VudC1lbmNyeXB0ZWQtcHJpdmF0ZS1rZXk=',
};
const REWRAPPED_KEY = { ...ORIGINAL_KEY, encryptedPrivateKey: 'cmV3cmFwcGVk' };
const REPLACEMENT_KEY = {
	...ORIGINAL_KEY,
	publicKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
};

describe('DM key mutation authorization', () => {
	let connection: MockConnection<IClientDirectory, IDirectoryClient>;

	beforeAll(async () => {
		await TestMockDb();
	});

	afterEach(() => {
		connection?.disconnect();
	});

	it('allows first-time creation, but requires sudo for rewrap or replacement', async () => {
		const password = 'test-password';
		const account = await TestMockAccount({ password });
		connection = new MockConnection<IClientDirectory, IDirectoryClient>({ onMessage: () => Promise.resolve(undefined) });
		new ClientConnection(new MockServerSocket<IDirectoryClient>(), connection.connect(), {});
		await expect(connection.awaitResponse('login', {
			username: account.username,
			passwordSha512: PrehashPassword(password),
		})).resolves.toMatchObject({ result: 'ok' });

		await expect(connection.awaitResponse('setCryptoKey', { cryptoKey: ORIGINAL_KEY })).resolves.toEqual({ result: 'ok' });
		await expect(connection.awaitResponse('setCryptoKey', { cryptoKey: ORIGINAL_KEY })).resolves.toEqual({ result: 'ok' });
		await expect(connection.awaitResponse('setCryptoKey', {
			cryptoKey: REWRAPPED_KEY,
			allowReset: 'same-key',
		})).resolves.toEqual({ result: 'sudoRequired' });
		await expect(connection.awaitResponse('setCryptoKey', {
			cryptoKey: REPLACEMENT_KEY,
			allowReset: 'replace-deleting-dms',
		})).resolves.toEqual({ result: 'sudoRequired' });
		expect(account.secure.getCryptoKey()).toEqual(ORIGINAL_KEY);

		await expect(connection.awaitResponse('sudoAuthenticate', {
			passwordSha512: PrehashPassword(password),
		})).resolves.toMatchObject({ result: 'ok' });
		await expect(connection.awaitResponse('setCryptoKey', {
			cryptoKey: REWRAPPED_KEY,
			allowReset: 'same-key',
		})).resolves.toEqual({ result: 'ok' });
		expect(account.secure.getCryptoKey()).toEqual(REWRAPPED_KEY);
		await expect(connection.awaitResponse('setCryptoKey', {
			cryptoKey: REPLACEMENT_KEY,
			allowReset: 'replace-deleting-dms',
		})).resolves.toEqual({ result: 'ok' });
		expect(account.secure.getCryptoKey()).toEqual(REPLACEMENT_KEY);
	});
});
