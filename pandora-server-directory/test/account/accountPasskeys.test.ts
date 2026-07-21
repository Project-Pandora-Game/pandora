import { describe, expect, it } from '@jest/globals';
import { createHash, createPublicKey, generateKeyPairSync, sign } from 'crypto';
import type { IAccountPasskeyCredential } from 'pandora-common/networking/api/directory_client';
import {
	Base64UrlEncode,
	CreatePasskeyChallenge,
	ValidatePasskeyRegistration,
	VerifyPasskeyAssertion,
} from '../../src/account/accountPasskeys.ts';

const ACCOUNT_ID = 1;
const ORIGIN = 'http://localhost:6969';
const RP_ID = 'localhost';

describe('accountPasskeys', () => {
	it('validates a registration response and consumes the challenge', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));
		const data = CreateRegistrationData(challenge, credentialId, keyPair.publicKey);

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId,
			...data,
		})).resolves.not.toBeNull();

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId,
			...data,
		})).resolves.toBeNull();
	});

	it('validates EdDSA registration response', async () => {
		const ed25519KeyPair = CreateEd25519KeyPair();
		const ed25519Challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const ed25519CredentialId = Base64UrlEncode(Buffer.from(`ed25519-credential-id-${-8}`, 'utf-8'));
		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId: ed25519CredentialId,
			...CreateRegistrationData(ed25519Challenge, ed25519CredentialId, ed25519KeyPair.publicKey, {
				cosePublicKey: CreateCoseEd25519PublicKey(ed25519KeyPair.publicKey, -8),
			}),
		})).resolves.not.toBeNull();
	});

	it.failing('validates Ed25519 registration response', async () => {
		const ed25519KeyPair = CreateEd25519KeyPair();
		const ed25519Challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const ed25519CredentialId = Base64UrlEncode(Buffer.from(`ed25519-credential-id-${-19}`, 'utf-8'));
		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId: ed25519CredentialId,
			...CreateRegistrationData(ed25519Challenge, ed25519CredentialId, ed25519KeyPair.publicKey, {
				cosePublicKey: CreateCoseEd25519PublicKey(ed25519KeyPair.publicKey, -19),
			}),
		})).resolves.not.toBeNull();
	});

	it('validates RS256 registration response', async () => {
		const rsaKeyPair = CreateRsaKeyPair();
		const rsaChallenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const rsaCredentialId = Base64UrlEncode(Buffer.from('rsa-credential-id', 'utf-8'));
		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId: rsaCredentialId,
			...CreateRegistrationData(rsaChallenge, rsaCredentialId, rsaKeyPair.publicKey, {
				cosePublicKey: CreateCoseRsaPublicKey(rsaKeyPair.publicKey),
			}),
		})).resolves.not.toBeNull();
	});

	it('validates YubiKey EdDSA registration authenticator data', async () => {
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const data = CreateYubiKeyEdDsaRegistrationData(challenge);

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			...data,
		})).resolves.not.toBeNull();
	});

	it('rejects registration for a wrong origin', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId,
			...CreateRegistrationData(challenge, credentialId, keyPair.publicKey, { origin: 'https://evil.example' }),
		})).resolves.toBeNull();
	});

	it('rejects registration for a wrong RP ID hash', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId,
			...CreateRegistrationData(challenge, credentialId, keyPair.publicKey, { rpId: 'evil.example' }),
		})).resolves.toBeNull();
	});

	it('rejects registration when credential id is not bound to authenticator data', async () => {
		const keyPair = CreateP256KeyPair();
		const challengeCredentialId = CreatePasskeyChallenge(ACCOUNT_ID, 'register');
		const credentialId = Base64UrlEncode(Buffer.from('credential-id', 'utf-8'));
		const data = CreateRegistrationData(challengeCredentialId, credentialId, keyPair.publicKey);

		await expect(ValidatePasskeyRegistration({
			accountId: ACCOUNT_ID,
			credentialId: Base64UrlEncode(Buffer.from('other-credential-id', 'utf-8')),
			...data,
		})).resolves.toBeNull();
	});

	it('verifies a passkey assertion signature', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 7);

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseP256PublicKey(keyPair.publicKey)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...assertion,
		})).resolves.toMatchObject({ newCounter: 7 });
	});

	it('verifies an Ed25519 passkey assertion signature', async () => {
		const keyPair = CreateEd25519KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 7, {}, null);

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseEd25519PublicKey(keyPair.publicKey)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...assertion,
		})).resolves.toMatchObject({ newCounter: 7 });
	});

	// Not yet supported by our passkey library
	it.failing('verifies an Ed25519 passkey assertion signature (Fully-Specified Algorithms)', async () => {
		const keyPair = CreateEd25519KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 7, {}, null);

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseEd25519PublicKey(keyPair.publicKey, -19)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...assertion,
		})).resolves.toMatchObject({ newCounter: 7 });
	});

	it('rejects an assertion with a rolled back sign counter', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		await expect(VerifyPasskeyAssertion({
			...CreatePasskey(CreateCoseP256PublicKey(keyPair.publicKey)),
			signCount: 7,
		}, {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...CreateAssertionData(challenge, keyPair.privateKey, 7),
		})).resolves.toBeNull();
	});

	it('rejects a zero sign counter after a passkey reported a counter', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		await expect(VerifyPasskeyAssertion({
			...CreatePasskey(CreateCoseP256PublicKey(keyPair.publicKey)),
			signCount: 7,
		}, {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...CreateAssertionData(challenge, keyPair.privateKey, 0),
		})).resolves.toBeNull();
	});

	it('rejects assertions signed by a different key', async () => {
		const storedKeyPair = CreateP256KeyPair();
		const attackerKeyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseP256PublicKey(storedKeyPair.publicKey)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...CreateAssertionData(challenge, attackerKeyPair.privateKey, 1),
		})).resolves.toBeNull();
	});

	it('rejects assertions without user verification', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseP256PublicKey(keyPair.publicKey)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...CreateAssertionData(challenge, keyPair.privateKey, 1, { flags: 1 }),
		})).resolves.toBeNull();
	});

	it('rejects malformed assertion authenticator data', async () => {
		const keyPair = CreateP256KeyPair();
		const challenge = CreatePasskeyChallenge(ACCOUNT_ID, 'login');
		const assertion = CreateAssertionData(challenge, keyPair.privateKey, 1);

		await expect(VerifyPasskeyAssertion(CreatePasskey(CreateCoseP256PublicKey(keyPair.publicKey)), {
			accountId: ACCOUNT_ID,
			purpose: 'login',
			...assertion,
			authenticatorData: Base64UrlEncode(Buffer.alloc(36)),
		})).resolves.toBeNull();
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

function CreateEd25519KeyPair() {
	return generateKeyPairSync('ed25519', {
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

function CreateRsaKeyPair() {
	return generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicExponent: 0x10001,
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
	cosePublicKey?: Buffer;
} = {}) {
	const authenticatorData = CreateRegistrationAuthenticatorData(credentialId, publicKey, options.rpId, options.flags, options.cosePublicKey);

	return {
		clientDataJSON: CreateClientData('webauthn.create', challenge, options.origin),
		attestationObject: Base64UrlEncode(CreateRegistrationAttestationData(authenticatorData)),
		authenticatorData: Base64UrlEncode(authenticatorData),
		publicKey: publicKey.toString('base64'),
	};
}

function CreateYubiKeyEdDsaRegistrationData(challenge: string) {
	// Captured from a YubiKey 5C NFC 5.7.4 EdDSA credential. RP hash and UV flag
	// are normalized because Pandora validates the public key, not attestation.
	const authenticatorData = Buffer.from('XStA8akYk0o4rRlJlntLoZAqimwVoeRv3d9WDlOJFopBAAAAAtd4Hl3jU0aqr+I8pJ8TMyoAgKSTpfpzT+9/pN7T8p5uDGsZHQYtv1hE/bpH0LXF+DDyFbn/8On0FyKpiCKeDdRnqMnK0TYZSIx0Bkq7Ut/GySkm/Og9mmvpusbyqVZsK7x1QJBgULxI/BRBmTRmduPHOzG8TndSYInqP7lvcZg1Wb645yYfDF+nFjlqEr8TfkuvpAEBAycgBiFYIIAXrb990Q0XMtnwNeGovQeQush7uMb+bmwgkg4JUYFg', 'base64');
	createHash('sha256').update(RP_ID, 'utf-8').digest().copy(authenticatorData, 0);
	authenticatorData[32] = 0x45;

	const credentialIdLength = authenticatorData.readUInt16BE(53);
	const credentialIdStart = 55;
	const credentialIdEnd = credentialIdStart + credentialIdLength;

	return {
		clientDataJSON: CreateClientData('webauthn.create', challenge),
		attestationObject: Base64UrlEncode(CreateRegistrationAttestationData(authenticatorData)),
		authenticatorData: Base64UrlEncode(authenticatorData),
		credentialId: Base64UrlEncode(authenticatorData.subarray(credentialIdStart, credentialIdEnd)),
		publicKey: 'MCowBQYDK2VwAyEAgBetv33RDRcy2fA14ai9B5C6yHu4xv5ubCCSDglRgWA=',
	};
}

function CreateAssertionData(challenge: string, privateKey: string, signCount: number, options: {
	origin?: string;
	rpId?: string;
	flags?: number;
} = {}, algorithm: string | null = 'sha256') {
	const clientDataJSON = CreateClientData('webauthn.get', challenge, options.origin);
	const authenticatorData = CreateAuthenticatorData(options.rpId, options.flags, signCount);
	const signedData = Buffer.concat([
		Base64UrlDecode(authenticatorData),
		createHash('sha256').update(Base64UrlDecode(clientDataJSON)).digest(),
	]);

	return {
		clientDataJSON,
		authenticatorData,
		signature: Base64UrlEncode(sign(algorithm, signedData, privateKey)),
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

function CreateRegistrationAttestationData(authenticatorData: Buffer): Uint8Array {
	const prefix = Uint8Array.from([
		0xa3, // map(3)
		0x63, 0x66, 0x6d, 0x74, // "fmt"
		0x64, 0x6e, 0x6f, 0x6e, 0x65, // "none"
		0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74, // "attStmt"
		0xa0, // {}
		0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61, // "authData"
	]);

	return new Uint8Array([
		...prefix,
		...CborByteString(authenticatorData),
	]);
}

function CreateRegistrationAuthenticatorData(credentialId: string, publicKey: Buffer, rpId = RP_ID, flags = 0x45, cosePublicKey = CreateCoseP256PublicKey(publicKey)): Buffer {
	const credentialIdBytes = Base64UrlDecode(credentialId);
	const data = Buffer.alloc(37 + 16 + 2 + credentialIdBytes.length + cosePublicKey.length);
	createHash('sha256').update(rpId, 'utf-8').digest().copy(data, 0);
	data[32] = flags;
	credentialIdBytes.copy(data, 37 + 16 + 2);
	data.writeUInt16BE(credentialIdBytes.length, 37 + 16);
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

function CreateCoseEd25519PublicKey(publicKey: Buffer, algorithm = -8): Buffer {
	const jwk = createPublicKey({
		key: publicKey,
		format: 'der',
		type: 'spki',
	}).export({ format: 'jwk' });
	if (jwk.x == null)
		throw new Error('Unexpected test Ed25519 public key');

	return Buffer.concat([
		Buffer.from([0xa4, 0x01, 0x01, 0x03]),
		CborInt(algorithm),
		Buffer.from([0x20, 0x06, 0x21]),
		CborByteString(Base64UrlDecode(jwk.x)),
	]);
}

function CreateCoseRsaPublicKey(publicKey: Buffer): Buffer {
	const jwk = createPublicKey({
		key: publicKey,
		format: 'der',
		type: 'spki',
	}).export({ format: 'jwk' });
	if (jwk.n == null || jwk.e == null)
		throw new Error('Unexpected test RSA public key');

	return Buffer.concat([
		Buffer.from([0xa4, 0x01, 0x03, 0x03, 0x39, 0x01, 0x00, 0x20]),
		CborByteString(Base64UrlDecode(jwk.n)),
		Buffer.from([0x21]),
		CborByteString(Base64UrlDecode(jwk.e)),
	]);
}

function CborByteString(data: Buffer): Buffer {
	if (data.length < 24)
		return Buffer.concat([Buffer.from([0x40 + data.length]), data]);
	if (data.length <= 0xff)
		return Buffer.concat([Buffer.from([0x58, data.length]), data]);
	if (data.length <= 0xffff)
		return Buffer.concat([Buffer.from([0x59, Math.floor(data.length / 256), data.length % 256]), data]);
	throw new Error('Test CBOR byte string too long');
}

function CborInt(value: number): Buffer {
	if (value >= 0 && value <= 23)
		return Buffer.from([value]);
	if (value < 0 && value >= -24)
		return Buffer.from([0x20 + (-1 - value)]);
	throw new Error('Test CBOR integer unsupported');
}

function Base64UrlDecode(data: string): Buffer {
	const normalized = data.replaceAll('-', '+').replaceAll('_', '/');
	const padding = '='.repeat((4 - normalized.length % 4) % 4);
	return Buffer.from(normalized + padding, 'base64');
}
