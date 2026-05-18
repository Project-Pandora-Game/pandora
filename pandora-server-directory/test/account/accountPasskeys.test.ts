import { describe, expect, it } from '@jest/globals';
import { createHash, generateKeyPairSync, sign } from 'crypto';
import type { IAccountPasskeyCredential } from 'pandora-common';
import {
	Base64UrlEncode,
	CreatePasskeyChallenge,
	CreatePasskeyPrfSalt,
	ValidatePasskeyRegistration,
	VerifyPasskeyAssertion,
} from '../../src/account/accountPasskeys.ts';

const ACCOUNT_ID = 1;
const ORIGIN = 'http://localhost:6969';
const RP_ID = 'localhost';

describe('accountPasskeys', () => {
	it('validates a registration response and consumes the challenge', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));
		const data = CreateRegistrationData(challenge, credentialId, keyPair.publicKey);

		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge,
			credentialId,
			...data,
		})).toBe(true);

		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge,
			credentialId,
			...data,
		})).toBe(false);
	});

	it('rejects registration for a wrong origin', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));

		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge,
			credentialId,
			...CreateRegistrationData(challenge, credentialId, keyPair.publicKey, { origin: 'https://evil.example' }),
		})).toBe(false);
	});

	it('rejects registration for a wrong RP ID hash', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));

		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge,
			credentialId,
			...CreateRegistrationData(challenge, credentialId, keyPair.publicKey, { rpId: 'evil.example' }),
		})).toBe(false);
	});

	it('rejects registration when credential id and public key are not bound to authenticator data', () => {
		const keyPair = CreateP256KeyPair();
		const attackerKeyPair = CreateP256KeyPair();
		const challengeCredentialId = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));
		const data = CreateRegistrationData(challengeCredentialId, credentialId, keyPair.publicKey);

		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge: challengeCredentialId,
			credentialId: Base64UrlEncode(Buffer.from('other-credential-id', 'utf-8')),
			...data,
		})).toBe(false);

		const challengePublicKey = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			challenge: challengePublicKey,
			credentialId,
			...CreateRegistrationData(challengePublicKey, credentialId, keyPair.publicKey),
			publicKey: attackerKeyPair.publicKey.toString('base64'),
		})).toBe(false);
	});

	it('verifies a passkey assertion signature', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 7);

		expect(VerifyPasskeyAssertion(CreatePasskey(keyPair.publicKey), {
			accountId: ACCOUNT_ID,
			challenge,
			...assertion,
		})).toEqual({ ok: true, signCount: 7 });
	});

	it('rejects an assertion with a rolled back sign counter', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		expect(VerifyPasskeyAssertion({
			...CreatePasskey(keyPair.publicKey),
			signCount: 7,
		}, {
			accountId: ACCOUNT_ID,
			challenge,
			...CreateAssertionData(challenge, keyPair.privateKey, 7),
		})).toEqual({ ok: false, reason: 'signCountRollback' });
	});

	it('rejects assertions signed by a different key', () => {
		const storedKeyPair = CreateP256KeyPair();
		const attackerKeyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		expect(VerifyPasskeyAssertion(CreatePasskey(storedKeyPair.publicKey), {
			accountId: ACCOUNT_ID,
			challenge,
			...CreateAssertionData(challenge, attackerKeyPair.privateKey, 1),
		})).toEqual({ ok: false });
	});

	it('rejects assertions without user verification', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		expect(VerifyPasskeyAssertion(CreatePasskey(keyPair.publicKey), {
			accountId: ACCOUNT_ID,
			challenge,
			...CreateAssertionData(challenge, keyPair.privateKey, 1, { flags: 1 }),
		})).toEqual({ ok: false });
	});

	it('rejects malformed assertion authenticator data', () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 1);

		expect(VerifyPasskeyAssertion(CreatePasskey(keyPair.publicKey), {
			accountId: ACCOUNT_ID,
			challenge,
			...assertion,
			authenticatorData: Base64UrlEncode(Buffer.alloc(36)),
		})).toEqual({ ok: false });
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

function CreatePasskey(publicKey: Buffer): IAccountPasskeyCredential {
	return {
		credentialId: 'credential-id',
		name: 'Test passkey',
		created: Date.now(),
		publicKey: publicKey.toString('base64'),
		signCount: 0,
		prfSalt: CreatePasskeyPrfSalt(),
		cryptoKey: {
			publicKey: 'public-key',
			salt: 'salt',
			iv: 'iv',
			encryptedPrivateKey: 'encrypted-private-key',
		},
	};
}

function CreateRegistrationData(challenge: string, credentialId: string, publicKey: Buffer, options: {
	origin?: string;
	rpId?: string;
	flags?: number;
} = {}) {
	return {
		clientDataJSON: CreateClientData('webauthn.create', challenge, options.origin),
		authenticatorData: CreateRegistrationAuthenticatorData(credentialId, publicKey, options.rpId, options.flags),
		publicKey: publicKey.toString('base64'),
	};
}

function CreateAssertionData(challenge: string, privateKey: string, signCount: number, options: {
	origin?: string;
	rpId?: string;
	flags?: number;
} = {}) {
	const clientDataJSON = CreateClientData('webauthn.get', challenge, options.origin);
	const authenticatorData = CreateAuthenticatorData(options.rpId, options.flags, signCount);
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

function CreateClientData(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin = ORIGIN): string {
	return Base64UrlEncode(Buffer.from(JSON.stringify({
		type,
		challenge,
		origin,
	}), 'utf-8'));
}

function CreateAuthenticatorData(rpId = RP_ID, flags = 5, signCount = 0): string {
	const data = Buffer.alloc(37);
	createHash('sha256').update(rpId, 'utf-8').digest().copy(data, 0);
	data[32] = flags;
	data.writeUInt32BE(signCount, 33);
	return Base64UrlEncode(data);
}

function CreateRegistrationAuthenticatorData(credentialId: string, publicKey: Buffer, rpId = RP_ID, flags = 0x45): string {
	const credentialIdBytes = Base64UrlDecode(credentialId);
	const cosePublicKey = CreateCoseP256PublicKey(publicKey);
	const data = Buffer.alloc(37 + 16 + 2 + credentialIdBytes.length + cosePublicKey.length);
	createHash('sha256').update(rpId, 'utf-8').digest().copy(data, 0);
	data[32] = flags;
	credentialIdBytes.copy(data, 37 + 16 + 2);
	data.writeUInt16BE(credentialIdBytes.length, 37 + 16);
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
