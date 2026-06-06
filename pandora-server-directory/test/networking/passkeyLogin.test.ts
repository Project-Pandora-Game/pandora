import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { createHash, generateKeyPairSync, sign } from 'crypto';
import { IClientDirectory, IDirectoryClient, MockConnection, MockServerSocket } from 'pandora-common';
import { AccountToken } from '../../src/account/accountSecure.ts';
import { AccountTokenReason } from '../../src/database/databaseStructure.ts';
import { PrehashPassword } from '../../src/database/mockDb.ts';
import { ClientConnection } from '../../src/networking/connection_client.ts';
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
			passkeys: [],
			passkeyRpId: RP_ID,
			passkeyUserId: Base64UrlEncode(Buffer.from(account.id.toString(10), 'utf-8')),
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
			publicKey: keyPair.publicKey.toString('base64url'),
			clientDataJSON: registration.clientDataJSON,
			attestationObject: registration.attestationObject,
			authenticatorData: registration.authenticatorData,
			transports: ['usb'],
			cryptoKey: PASSKEY_WRAPPED_CRYPTO_KEY,
		})).resolves.toEqual({ result: 'ok' });

		await expect(connection.awaitResponse('passkeyList', {})).resolves.toMatchObject({
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
			passkeys: [{
				credentialId,
				name: 'Integration test passkey',
				lastUsed: expect.any(Number),
			}],
			passkeyRpId: RP_ID,
			passkeyUserId: Base64UrlEncode(Buffer.from(account.id.toString(10), 'utf-8')),
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

	it('works with valid key', async () => {
		const account = await TestMockAccount({ username: `passkey-failed-${Date.now()}` });
		await account.secure.setCryptoKey(ACCOUNT_CRYPTO_KEY);
		const keyPair = CreateP256KeyPair();
		const credentialId = Base64UrlEncode(Buffer.from(`failed-credential-${account.id}`, 'utf-8'));
		await account.secure.addPasskey(CreatePasskey(credentialId, CreateCoseP256PublicKey(keyPair.publicKey)));

		const startLogin = await connection.awaitResponse('passkeyLoginStart', {});
		expect(startLogin.result).toBe('ok');
		if (startLogin.result !== 'ok')
			throw new Error('Passkey login did not start');

		await expect(connection.awaitResponse('passkeyLoginFinish', {
			credentialId,
			...CreateAssertionData(startLogin.challenge, keyPair.privateKey, 1),
		})).resolves.toMatchObject({ result: 'ok' });
	});

	it('separates failed passkey verification from unknown credentials', async () => {
		const account = await TestMockAccount({ username: `passkey-failed-${Date.now()}` });
		await account.secure.setCryptoKey(ACCOUNT_CRYPTO_KEY);
		const keyPair = CreateP256KeyPair();
		const attackerKeyPair = CreateP256KeyPair();
		const credentialId = Base64UrlEncode(Buffer.from(`failed-credential-${account.id}`, 'utf-8'));
		await account.secure.addPasskey(CreatePasskey(credentialId, CreateCoseP256PublicKey(keyPair.publicKey)));

		const startLogin = await connection.awaitResponse('passkeyLoginStart', {});
		expect(startLogin.result).toBe('ok');
		if (startLogin.result !== 'ok')
			throw new Error('Passkey login did not start');

		await expect(connection.awaitResponse('passkeyLoginFinish', {
			credentialId,
			...CreateAssertionData(startLogin.challenge, attackerKeyPair.privateKey, 1),
		})).resolves.toEqual({ result: 'failed' });
	});

	it('does not report disabled or inactive passkey accounts as unknown credentials', async () => {
		const disabledAccount = await TestMockAccount({ username: `passkey-disabled-${Date.now()}` });
		await disabledAccount.secure.setCryptoKey(ACCOUNT_CRYPTO_KEY);
		const disabledKeyPair = CreateP256KeyPair();
		const disabledCredentialId = Base64UrlEncode(Buffer.from(`disabled-credential-${disabledAccount.id}`, 'utf-8'));
		await disabledAccount.secure.addPasskey(CreatePasskey(disabledCredentialId, CreateCoseP256PublicKey(disabledKeyPair.publicKey)));
		await disabledAccount.secure.adminDisableAccount({
			time: Date.now(),
			publicReason: 'Disabled for test',
			internalReason: 'Disabled for test',
			disabledBy: 0,
		});

		const disabledStart = await connection.awaitResponse('passkeyLoginStart', {});
		expect(disabledStart.result).toBe('ok');
		if (disabledStart.result !== 'ok')
			throw new Error('Disabled passkey login did not start');

		await expect(connection.awaitResponse('passkeyLoginFinish', {
			credentialId: disabledCredentialId,
			...CreateAssertionData(disabledStart.challenge, disabledKeyPair.privateKey, 1),
		})).resolves.toEqual({
			result: 'accountDisabled',
			reason: 'Disabled for test',
		});

		const inactiveAccount = await TestMockAccount({ username: `passkey-inactive-${Date.now()}`, activated: false });
		await inactiveAccount.secure.setCryptoKey(ACCOUNT_CRYPTO_KEY);
		const inactiveKeyPair = CreateP256KeyPair();
		const inactiveCredentialId = Base64UrlEncode(Buffer.from(`inactive-credential-${inactiveAccount.id}`, 'utf-8'));
		await inactiveAccount.secure.addPasskey(CreatePasskey(inactiveCredentialId, CreateCoseP256PublicKey(inactiveKeyPair.publicKey)));

		const inactiveStart = await connection.awaitResponse('passkeyLoginStart', {});
		expect(inactiveStart.result).toBe('ok');
		if (inactiveStart.result !== 'ok')
			throw new Error('Inactive passkey login did not start');

		await expect(connection.awaitResponse('passkeyLoginFinish', {
			credentialId: inactiveCredentialId,
			...CreateAssertionData(inactiveStart.challenge, inactiveKeyPair.privateKey, 1),
		})).resolves.toEqual({ result: 'verificationRequired' });
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
	const authenticatorData = CreateRegistrationAuthenticatorData(credentialId, publicKey);
	return {
		clientDataJSON: CreateClientData('webauthn.create', challenge),
		authenticatorData: Base64UrlEncode(authenticatorData),
		attestationObject: Base64UrlEncode(CreateRegistrationAttestationData(authenticatorData)),
		publicKey: publicKey.toString('base64'),
	};
}

function CreatePasskey(credentialId: string, publicKey: Buffer) {
	return {
		credentialId,
		name: 'Integration test passkey',
		created: Date.now(),
		publicKey: publicKey.toString('base64'),
		signCount: 0,
		transports: ['usb'],
		cryptoKey: PASSKEY_WRAPPED_CRYPTO_KEY,
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

function CreateRegistrationAttestationData(authenticatorData: Buffer): Uint8Array {
	const authData = new Uint8Array(authenticatorData);

	const prefix = Uint8Array.from([
		0xa3, // map(3)
		0x63, 0x66, 0x6d, 0x74, // "fmt"
		0x64, 0x6e, 0x6f, 0x6e, 0x65, // "none"
		0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74, // "attStmt"
		0xa0, // {}
		0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61, // "authData"
	]);

	const authDataHeader =
		authData.length < 24
			? Uint8Array.of(0x40 + authData.length)
			: Uint8Array.of(0x58, authData.length);

	return new Uint8Array([
		...prefix,
		...authDataHeader,
		...authData,
	]);
}

function CreateRegistrationAuthenticatorData(credentialId: string, publicKey: Buffer): Buffer {
	const credentialIdBytes = Base64UrlDecode(credentialId);
	const cosePublicKey = CreateCoseP256PublicKey(publicKey);
	const data = Buffer.alloc(37 + 16 + 2 + credentialIdBytes.length + cosePublicKey.length);
	createHash('sha256').update(RP_ID, 'utf-8').digest().copy(data, 0);
	data[32] = 0x45;
	data.writeUInt16BE(credentialIdBytes.length, 37 + 16);
	credentialIdBytes.copy(data, 37 + 16 + 2);
	cosePublicKey.copy(data, 37 + 16 + 2 + credentialIdBytes.length);
	return data;
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
