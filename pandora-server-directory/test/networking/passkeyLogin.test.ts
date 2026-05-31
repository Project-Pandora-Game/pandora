import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { createHash, generateKeyPairSync, sign } from 'crypto';
import { IDirectoryClient, IClientDirectory, MockConnection, MockServerSocket } from 'pandora-common';
import { AccountToken } from '../../src/account/accountSecure.ts';
import { AccountTokenReason } from '../../src/database/databaseStructure.ts';
import { ClientConnection } from '../../src/networking/connection_client.ts';
import { PrehashPassword } from '../../src/database/mockDb.ts';
import { TestMockAccount, TestMockDb } from '../utils.ts';

void AccountToken;
void AccountTokenReason;

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:6969';

const ACCOUNT_CRYPTO_KEY = {
	publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWDmwBlEMYi3nu7FsotmBDrHxxaX6rW8SaDQZkXPIAaofK4ZVD01Yac5yrMtX3/dWA8c720sGWQhhyyRkeEBB9Q==',
	salt: 'YWNjb3VudC1zYWx0',
	iv: 'YWNjb3VudC1pdg==',
	encryptedPrivateKey: 'YWNjb3VudC1lbmNyeXB0ZWQtcHJpdmF0ZS1rZXk=',
};

const PASSKEY_WRAPPED_CRYPTO_KEY = {
	...ACCOUNT_CRYPTO_KEY,
	salt: 'cGFzc2tleS1zYWx0',
	iv: 'cGFzc2tleS1pdg==',
	encryptedPrivateKey: 'cGFzc2tleS1lbmNyeXB0ZWQtcHJpdmF0ZS1rZXk=',
};

describe('passkey login flow', () => {
	let connection: MockConnection<IClientDirectory, IDirectoryClient>;

	beforeAll(async () => {
		await TestMockDb();
	});

	beforeEach(() => {
		const server = new MockServerSocket<IDirectoryClient>();
		connection = new MockConnection<IClientDirectory, IDirectoryClient>({ onMessage: () => Promise.resolve(undefined) });
		new ClientConnection(server, connection.connect(), {});
	});

	afterEach(() => {
		connection.disconnect();
	});

	it('registers a passkey and logs in with the passkey-wrapped DM key', async () => {
		const username = `passkey-${Date.now()}`;
		const password = 'test-password';
		const account = await TestMockAccount({ username, password });
		await account.secure.setCryptoKey(ACCOUNT_CRYPTO_KEY);

		await expect(connection.awaitResponse('login', {
			username,
			passwordSha512: PrehashPassword(password),
		})).resolves.toMatchObject({
			result: 'ok',
			account: {
				id: account.id,
				username,
			},
		});

		await expect(connection.awaitResponse('passkeyRegisterStart', {})).resolves.toEqual({ result: 'sudoRequired' });
		await expect(connection.awaitResponse('sudoAuthenticate', {
			passwordSha512: PrehashPassword('wrong-password'),
		})).resolves.toEqual({ result: 'invalidPassword' });
		await expect(connection.awaitResponse('sudoAuthenticate', {
			passwordSha512: PrehashPassword(password),
		})).resolves.toMatchObject({ result: 'ok' });

		const startRegistration = await connection.awaitResponse('passkeyRegisterStart', {});
		expect(startRegistration).toMatchObject({
			result: 'ok',
			rpId: RP_ID,
			excludeCredentials: [],
		});
		expect(startRegistration.result).toBe('ok');
		if (startRegistration.result !== 'ok')
			throw new Error('Passkey registration did not start');

		const keyPair = CreateP256KeyPair();
		const credentialId = Base64UrlEncode(Buffer.from(`credential-${account.id}`, 'utf-8'));
		const registration = CreateRegistrationData(startRegistration.challenge, credentialId, keyPair.publicKey);

		await expect(connection.awaitResponse('passkeyRegisterFinish', {
			name: 'Integration test passkey',
			credentialId,
			publicKey: keyPair.publicKey.toString('base64'),
			clientDataJSON: registration.clientDataJSON,
			authenticatorData: registration.authenticatorData,
			transports: ['usb'],
			cryptoKey: PASSKEY_WRAPPED_CRYPTO_KEY,
		})).resolves.toEqual({ result: 'ok' });

		await expect(connection.awaitResponse('passkeyList', {})).resolves.toMatchObject({
			limit: 5,
			passkeys: [{
				credentialId,
				name: 'Integration test passkey',
			}],
		});

		connection.disconnect();
		const server = new MockServerSocket<IDirectoryClient>();
		connection = new MockConnection<IClientDirectory, IDirectoryClient>({ onMessage: () => Promise.resolve(undefined) });
		new ClientConnection(server, connection.connect(), {});

		const startLogin = await connection.awaitResponse('passkeyLoginStart', {});
		expect(startLogin.result).toBe('ok');
		if (startLogin.result !== 'ok')
			throw new Error('Passkey login did not start');
		expect(startLogin).toMatchObject({
			rpId: RP_ID,
			prfSalt: startRegistration.prfSalt,
		});
		expect(startLogin).not.toHaveProperty('credentials');

		const assertion = CreateAssertionData(startLogin.challenge, keyPair.privateKey, 12);
		await expect(connection.awaitResponse('passkeyLoginFinish', {
			credentialId,
			clientDataJSON: assertion.clientDataJSON,
			authenticatorData: assertion.authenticatorData,
			signature: assertion.signature,
		})).resolves.toMatchObject({
			result: 'ok',
			account: {
				id: account.id,
				username,
			},
			cryptoKey: PASSKEY_WRAPPED_CRYPTO_KEY,
			token: {
				value: expect.any(String),
				expires: expect.any(Number),
			},
		});

		await expect(connection.awaitResponse('passkeyList', {})).resolves.toMatchObject({
			passkeys: [{
				credentialId,
				lastUsed: expect.any(Number),
			}],
		});

		await expect(connection.awaitResponse('passkeyRename', {
			credentialId,
			name: 'Renamed passkey',
		})).resolves.toEqual({ result: 'sudoRequired' });

		const sudoStart = await connection.awaitResponse('sudoPasskeyStart', {});
		expect(sudoStart.result).toBe('ok');
		if (sudoStart.result !== 'ok')
			throw new Error('Passkey security confirmation did not start');
		expect(sudoStart).toMatchObject({
			rpId: RP_ID,
			credentials: [{
				id: credentialId,
				type: 'public-key',
				transports: ['usb'],
			}],
			prfSalt: startRegistration.prfSalt,
		});

		const sudoAssertion = CreateAssertionData(sudoStart.challenge, keyPair.privateKey, 13);
		await expect(connection.awaitResponse('sudoPasskeyFinish', {
			credentialId,
			clientDataJSON: sudoAssertion.clientDataJSON,
			authenticatorData: sudoAssertion.authenticatorData,
			signature: sudoAssertion.signature,
		})).resolves.toMatchObject({
			result: 'ok',
			expires: expect.any(Number),
		});

		await expect(connection.awaitResponse('passkeyRename', {
			credentialId,
			name: 'Renamed passkey',
		})).resolves.toEqual({ result: 'ok' });

		expect(account.secure.listPasskeys()).toEqual([{
			credentialId,
			name: 'Renamed passkey',
			created: expect.any(Number),
			lastUsed: expect.any(Number),
		}]);
	});

	it('starts resident passkey login without a username', async () => {
		const startMissing = await connection.awaitResponse('passkeyLoginStart', {});

		expect(startMissing).toEqual({
			result: 'ok',
			rpId: RP_ID,
			challenge: expect.any(String),
			prfSalt: expect.any(String),
		});
		expect(startMissing).not.toHaveProperty('credentials');
	});
});

function CreateP256KeyPair() {
	return generateKeyPairSync('ec', {
		namedCurve: 'prime256v1',
		publicKeyEncoding: {
			format: 'der',
			type: 'spki',
		},
		privateKeyEncoding: {
			format: 'pem',
			type: 'pkcs8',
		},
	});
}

function CreateRegistrationData(challenge: string, credentialId: string, publicKey: Buffer) {
	return {
		clientDataJSON: CreateClientData('webauthn.create', challenge),
		authenticatorData: CreateRegistrationAuthenticatorData(credentialId, publicKey),
		publicKey: publicKey.toString('base64'),
	};
}

function CreateAssertionData(challenge: string, privateKey: string, signCount: number) {
	const clientDataJSON = CreateClientData('webauthn.get', challenge);
	const authenticatorData = CreateAuthenticatorData(signCount);
	const signedData = Buffer.concat([
		Base64UrlDecode(authenticatorData),
		createHash('sha256').update(Base64UrlDecode(clientDataJSON)).digest(),
	]);

	return {
		clientDataJSON,
		authenticatorData,
		signature: Base64UrlEncode(sign('sha256', signedData, privateKey)),
	};
}

function CreateClientData(type: 'webauthn.create' | 'webauthn.get', challenge: string): string {
	return Base64UrlEncode(Buffer.from(JSON.stringify({
		type,
		challenge,
		origin: ORIGIN,
	}), 'utf-8'));
}

function CreateAuthenticatorData(signCount = 0): string {
	const data = Buffer.alloc(37);
	createHash('sha256').update(RP_ID, 'utf-8').digest().copy(data, 0);
	data[32] = 5;
	data.writeUInt32BE(signCount, 33);
	return Base64UrlEncode(data);
}

function CreateRegistrationAuthenticatorData(credentialId: string, publicKey: Buffer): string {
	const credentialIdBytes = Base64UrlDecode(credentialId);
	const cosePublicKey = CreateCoseP256PublicKey(publicKey);
	const data = Buffer.alloc(37 + 16 + 2 + credentialIdBytes.length + cosePublicKey.length);
	createHash('sha256').update(RP_ID, 'utf-8').digest().copy(data, 0);
	data[32] = 0x45;
	data.writeUInt16BE(credentialIdBytes.length, 37 + 16);
	credentialIdBytes.copy(data, 37 + 16 + 2);
	cosePublicKey.copy(data, 37 + 16 + 2 + credentialIdBytes.length);
	return Base64UrlEncode(data);
}

function CreateCoseP256PublicKey(publicKey: Buffer): Buffer {
	const uncompressedPoint = publicKey.subarray(publicKey.length - 65);
	if (uncompressedPoint[0] !== 4)
		throw new Error('Unexpected test public key');
	const x = uncompressedPoint.subarray(1, 33);
	const y = uncompressedPoint.subarray(33, 65);
	return Buffer.concat([
		Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
		x,
		Buffer.from([0x22, 0x58, 0x20]),
		y,
	]);
}

function Base64UrlDecode(data: string): Buffer {
	const normalized = data.replaceAll('-', '+').replaceAll('_', '/');
	const padding = '='.repeat((4 - normalized.length % 4) % 4);
	return Buffer.from(normalized + padding, 'base64');
}

function Base64UrlEncode(data: Buffer | Uint8Array): string {
	return Buffer.from(data)
		.toString('base64')
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');
}
