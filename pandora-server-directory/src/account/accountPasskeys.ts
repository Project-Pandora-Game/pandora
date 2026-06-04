import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from 'crypto';
import type { AccountId, IAccountPasskeyCredential } from 'pandora-common';
import { ENV } from '../config.ts';

const { PASSKEY_ALLOWED_ORIGINS, PASSKEY_RP_ID } = ENV;
const PASSKEY_ORIGIN_SET = new Set(PASSKEY_ALLOWED_ORIGINS
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean));

type ChallengePurpose = 'register' | 'login' | 'sudo';

type ChallengeRecord = {
	accountId: AccountId | null;
	purpose: ChallengePurpose;
	created: number;
};

/** @see https://www.w3.org/TR/webauthn-3/#authenticator-data */
const WEBAUTHN_AUTHENTICATOR_DATA_RP_ID_HASH_LENGTH = 32;
/** @see https://www.w3.org/TR/webauthn-3/#authenticator-data */
const WEBAUTHN_AUTHENTICATOR_DATA_FLAGS_OFFSET = WEBAUTHN_AUTHENTICATOR_DATA_RP_ID_HASH_LENGTH;
/** @see https://www.w3.org/TR/webauthn-3/#authenticator-data */
const WEBAUTHN_AUTHENTICATOR_DATA_SIGN_COUNT_OFFSET = WEBAUTHN_AUTHENTICATOR_DATA_FLAGS_OFFSET + 1;
/** @see https://www.w3.org/TR/webauthn-3/#authenticator-data */
const WEBAUTHN_AUTHENTICATOR_DATA_HEADER_LENGTH = WEBAUTHN_AUTHENTICATOR_DATA_SIGN_COUNT_OFFSET + 4;
/** @see https://www.w3.org/TR/webauthn-3/#authenticator-data */
const WEBAUTHN_AAGUID_BYTE_LENGTH = 16;
/** @see https://www.w3.org/TR/webauthn-3/#authdata-flags */
const WEBAUTHN_FLAG_USER_PRESENT = 0x01;
/** @see https://www.w3.org/TR/webauthn-3/#authdata-flags */
const WEBAUTHN_FLAG_USER_VERIFIED = 0x04;
/** @see https://www.w3.org/TR/webauthn-3/#authdata-flags */
const WEBAUTHN_FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_LABEL_KTY = 1;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_LABEL_ALG = 3;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_LABEL_CRV = -1;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_LABEL_X = -2;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_LABEL_Y = -3;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_TYPE_EC2 = 2;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_TYPE_OKP = 1;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_KEY_TYPE_RSA = 3;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_ED25519 = -19;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_EDDSA = -8;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_ES256 = -7;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_RS256 = -257;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ELLIPTIC_CURVE_ED25519 = 6;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ELLIPTIC_CURVE_P256 = 1;
/** @see https://www.secg.org/sec1-v2.pdf section 2.3.5 */
const COSE_P256_COORDINATE_BYTE_LENGTH = 32;
/** @see https://www.rfc-editor.org/rfc/rfc8037#section-2 */
const COSE_ED25519_PUBLIC_KEY_BYTE_LENGTH = 32;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_UNSIGNED_INTEGER = 0;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_NEGATIVE_INTEGER = 1;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_BYTE_STRING = 2;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_TEXT_STRING = 3;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_ARRAY = 4;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_MAP = 5;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_FLOAT_SIMPLE = 7;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_ADDITIONAL_INFO_ONE_BYTE_VALUE = 24;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_ADDITIONAL_INFO_TWO_BYTE_VALUE = 25;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_ADDITIONAL_INFO_FOUR_BYTE_VALUE = 26;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_DIVISOR = 32;
/** @see https://www.w3.org/TR/webauthn-3/#cryptographic-challenges */
const PASSKEY_CHALLENGE_BYTE_LENGTH = 32;
/** @see https://www.w3.org/TR/webauthn-3/#prf-extension */
const PASSKEY_PRF_SALT_BYTE_LENGTH = 32;
const CHALLENGE_TTL = 5 * 60_000;
const MAX_PASSKEY_CHALLENGES = 10_000;
const PASSKEY_PRF_SALT = Base64UrlEncode(createHash('sha256')
	.update(`project-pandora:passkey-prf:${PASSKEY_RP_ID}`, 'utf-8')
	.digest()
	.subarray(0, PASSKEY_PRF_SALT_BYTE_LENGTH));
const PASSKEY_RP_ID_HASH = createHash('sha256').update(PASSKEY_RP_ID, 'utf-8').digest();
const challenges = new Map<string, ChallengeRecord>();

export function CreatePasskeyChallenge(accountId: AccountId | null, purpose: ChallengePurpose): string {
	const now = Date.now();
	PruneExpiredPasskeyChallenges(now);

	const challenge = Base64UrlEncode(randomBytes(PASSKEY_CHALLENGE_BYTE_LENGTH));
	challenges.set(challenge, {
		accountId,
		purpose,
		created: now,
	});
	PruneOldestPasskeyChallenges();
	return challenge;
}

function PruneExpiredPasskeyChallenges(now: number): void {
	for (const [challenge, record] of challenges) {
		if (now - record.created > CHALLENGE_TTL)
			challenges.delete(challenge);
	}
}

function PruneOldestPasskeyChallenges(): void {
	for (const challenge of challenges.keys()) {
		if (challenges.size <= MAX_PASSKEY_CHALLENGES)
			return;
		challenges.delete(challenge);
	}
}

export function GetPasskeyPrfSalt(): string {
	return PASSKEY_PRF_SALT;
}

export function ConsumePasskeyChallenge(challenge: string, accountId: AccountId, purpose: ChallengePurpose): boolean {
	const record = challenges.get(challenge);
	challenges.delete(challenge);
	if (record == null)
		return false;
	if (record.accountId != null && record.accountId !== accountId)
		return false;
	if (record.purpose !== purpose)
		return false;
	return Date.now() - record.created <= CHALLENGE_TTL;
}

export function GetPasskeyClientChallenge(clientDataJSON: string): string | undefined {
	return ParseClientData(clientDataJSON)?.challenge;
}

export function ValidatePasskeyRegistration(data: {
	accountId: AccountId;
	challenge: string;
	credentialId: string;
	clientDataJSON: string;
	authenticatorData: string;
	publicKey: string;
}): boolean {
	const clientData = ParseClientData(data.clientDataJSON);
	if (clientData?.type !== 'webauthn.create' || clientData.challenge !== data.challenge)
		return false;
	if (!PASSKEY_ORIGIN_SET.has(clientData.origin))
		return false;
	if (!ConsumePasskeyChallenge(data.challenge, data.accountId, 'register'))
		return false;

	const authenticatorData = Base64UrlDecode(data.authenticatorData);
	if (!ValidateRegistrationAuthenticatorData(authenticatorData, data.credentialId, data.publicKey))
		return false;

	try {
		createPublicKey({
			key: Buffer.from(data.publicKey, 'base64'),
			format: 'der',
			type: 'spki',
		});
		return true;
	} catch {
		return false;
	}
}

export function VerifyPasskeyAssertion(passkey: IAccountPasskeyCredential, data: {
	accountId: AccountId;
	challenge: string;
	clientDataJSON: string;
	authenticatorData: string;
	signature: string;
	purpose?: Extract<ChallengePurpose, 'login' | 'sudo'>;
}): { ok: true; signCount: number; } | { ok: false; reason?: 'signCountRollback'; } {
	const clientData = ParseClientData(data.clientDataJSON);
	if (clientData?.type !== 'webauthn.get' || clientData.challenge !== data.challenge)
		return { ok: false };
	if (!PASSKEY_ORIGIN_SET.has(clientData.origin))
		return { ok: false };
	if (!ConsumePasskeyChallenge(data.challenge, data.accountId, data.purpose ?? 'login'))
		return { ok: false };

	const authenticatorData = Base64UrlDecode(data.authenticatorData);
	if (!ValidateAssertionAuthenticatorData(authenticatorData))
		return { ok: false };

	const signedData = Buffer.concat([
		authenticatorData,
		createHash('sha256').update(Base64UrlDecode(data.clientDataJSON)).digest(),
	]);
	const key = createPublicKey({
		key: Buffer.from(passkey.publicKey, 'base64'),
		format: 'der',
		type: 'spki',
	});
	const algorithm = key.asymmetricKeyType === 'ed25519' ? null : 'sha256';
	if (!verify(algorithm, signedData, key, Base64UrlDecode(data.signature)))
		return { ok: false };
	const signCount = authenticatorData.readUInt32BE(WEBAUTHN_AUTHENTICATOR_DATA_SIGN_COUNT_OFFSET);
	if (passkey.signCount !== 0 && signCount <= passkey.signCount)
		return { ok: false, reason: 'signCountRollback' };

	return {
		ok: true,
		signCount,
	};
}

export function Base64UrlEncode(data: Buffer | Uint8Array): string {
	return Buffer.from(data).toString('base64url');
}

export function Base64UrlDecode(data: string): Buffer {
	return Buffer.from(data, 'base64url');
}

function ParseClientData(data: string): { type: string; challenge: string; origin: string; } | null {
	try {
		const parsed = JSON.parse(Base64UrlDecode(data).toString('utf-8')) as unknown;
		if (
			typeof parsed !== 'object' ||
			parsed == null ||
			!('type' in parsed) ||
			!('challenge' in parsed) ||
			!('origin' in parsed) ||
			typeof parsed.type !== 'string' ||
			typeof parsed.challenge !== 'string' ||
			typeof parsed.origin !== 'string'
		) {
			return null;
		}
		return {
			type: parsed.type,
			challenge: parsed.challenge,
			origin: parsed.origin,
		};
	} catch {
		return null;
	}
}

function ValidateRpIdHash(authenticatorData: Buffer): boolean {
	const actual = authenticatorData.subarray(0, WEBAUTHN_AUTHENTICATOR_DATA_RP_ID_HASH_LENGTH);
	return actual.length === PASSKEY_RP_ID_HASH.length && timingSafeEqual(actual, PASSKEY_RP_ID_HASH);
}

function ValidateCommonAuthenticatorData(authenticatorData: Buffer): boolean {
	if (authenticatorData.length < WEBAUTHN_AUTHENTICATOR_DATA_HEADER_LENGTH)
		return false;
	if (!ValidateRpIdHash(authenticatorData))
		return false;
	const flags = authenticatorData[WEBAUTHN_AUTHENTICATOR_DATA_FLAGS_OFFSET] ?? 0;
	return HasAuthenticatorFlag(flags, WEBAUTHN_FLAG_USER_PRESENT) && HasAuthenticatorFlag(flags, WEBAUTHN_FLAG_USER_VERIFIED);
}

function ValidateAssertionAuthenticatorData(authenticatorData: Buffer): boolean {
	return ValidateCommonAuthenticatorData(authenticatorData);
}

function ValidateRegistrationAuthenticatorData(authenticatorData: Buffer, credentialId: string, publicKey: string): boolean {
	if (!ValidateCommonAuthenticatorData(authenticatorData))
		return false;

	const flags = authenticatorData[WEBAUTHN_AUTHENTICATOR_DATA_FLAGS_OFFSET] ?? 0;
	if (!HasAuthenticatorFlag(flags, WEBAUTHN_FLAG_ATTESTED_CREDENTIAL_DATA))
		return false;

	const attestedCredential = ParseAttestedCredentialData(authenticatorData);
	if (attestedCredential == null)
		return false;
	if (Base64UrlEncode(attestedCredential.credentialId) !== credentialId)
		return false;
	if (DeriveSpkiFromCose(attestedCredential.cosePublicKey)?.toString('base64') !== publicKey)
		return false;

	return true;
}

function ParseAttestedCredentialData(authenticatorData: Buffer): { credentialId: Buffer; cosePublicKey: Buffer; } | undefined {
	const credentialIdLengthOffset = WEBAUTHN_AUTHENTICATOR_DATA_HEADER_LENGTH + WEBAUTHN_AAGUID_BYTE_LENGTH;
	if (authenticatorData.length < credentialIdLengthOffset + 2)
		return undefined;

	const credentialIdLength = authenticatorData.readUInt16BE(credentialIdLengthOffset);
	const credentialIdStart = credentialIdLengthOffset + 2;
	const credentialIdEnd = credentialIdStart + credentialIdLength;
	if (credentialIdLength === 0 || authenticatorData.length <= credentialIdEnd)
		return undefined;

	return {
		credentialId: authenticatorData.subarray(credentialIdStart, credentialIdEnd),
		cosePublicKey: authenticatorData.subarray(credentialIdEnd),
	};
}

function DeriveSpkiFromCose(cosePublicKey: Buffer): Buffer | undefined {
	try {
		const reader = new CborReader(cosePublicKey);
		const mapSize = reader.readMapHeader();
		let kty: number | undefined;
		let alg: number | undefined;
		let crv: number | undefined;
		let x: Buffer | undefined;
		let y: Buffer | undefined;
		let n: Buffer | undefined;
		let e: Buffer | undefined;

		for (let i = 0; i < mapSize; i++) {
			const key = reader.readInt();
			switch (key) {
				case COSE_KEY_LABEL_KTY:
					kty = reader.readInt();
					break;
				case COSE_KEY_LABEL_ALG:
					alg = reader.readInt();
					break;
				case COSE_KEY_LABEL_CRV:
					{
						const value = reader.readIntOrBytes();
						if (typeof value === 'number')
							crv = value;
						else
							n = value;
					}
					break;
				case COSE_KEY_LABEL_X:
					{
						const value = reader.readBytes();
						if (kty === COSE_KEY_TYPE_RSA)
							e = value;
						else
							x = value;
					}
					break;
				case COSE_KEY_LABEL_Y:
					y = reader.readBytes();
					break;
				default:
					reader.skipItem();
					break;
			}
		}

		if (
			kty === COSE_KEY_TYPE_OKP &&
			(alg === COSE_ALGORITHM_ED25519 || alg === COSE_ALGORITHM_EDDSA) &&
			crv === COSE_ELLIPTIC_CURVE_ED25519 &&
			x?.length === COSE_ED25519_PUBLIC_KEY_BYTE_LENGTH
		) {
			return createPublicKey({
				key: {
					kty: 'OKP',
					crv: 'Ed25519',
					x: Base64UrlEncode(x),
				},
				format: 'jwk',
			}).export({ format: 'der', type: 'spki' });
		}

		if (
			kty === COSE_KEY_TYPE_EC2 &&
			alg === COSE_ALGORITHM_ES256 &&
			crv === COSE_ELLIPTIC_CURVE_P256 &&
			x?.length === COSE_P256_COORDINATE_BYTE_LENGTH &&
			y?.length === COSE_P256_COORDINATE_BYTE_LENGTH
		) {
			const p256SpkiPrefix = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d03010703420004', 'hex');
			return Buffer.concat([p256SpkiPrefix, x, y]);
		}

		if (
			kty === COSE_KEY_TYPE_RSA &&
			alg === COSE_ALGORITHM_RS256 &&
			n != null &&
			e != null
		) {
			return createPublicKey({
				key: {
					kty: 'RSA',
					n: Base64UrlEncode(n),
					e: Base64UrlEncode(e),
				},
				format: 'jwk',
			}).export({ format: 'der', type: 'spki' });
		}

		return undefined;
	} catch {
		return undefined;
	}
}

class CborReader {
	readonly #data: Buffer;
	#offset = 0;

	constructor(data: Buffer) {
		this.#data = data;
	}

	public readMapHeader(): number {
		const { major, value } = this.#readTypeAndValue();
		if (major !== CBOR_MAJOR_TYPE_MAP)
			throw new Error('Expected CBOR map');
		return value;
	}

	public readInt(): number {
		const { major, value } = this.#readTypeAndValue();
		if (major === CBOR_MAJOR_TYPE_UNSIGNED_INTEGER)
			return value;
		if (major === CBOR_MAJOR_TYPE_NEGATIVE_INTEGER)
			return -1 - value;
		throw new Error('Expected CBOR integer');
	}

	public readIntOrBytes(): number | Buffer {
		const { major, value } = this.#readTypeAndValue();
		if (major === CBOR_MAJOR_TYPE_UNSIGNED_INTEGER)
			return value;
		if (major === CBOR_MAJOR_TYPE_NEGATIVE_INTEGER)
			return -1 - value;
		if (major === CBOR_MAJOR_TYPE_BYTE_STRING)
			return this.#readBytes(value);
		throw new Error('Expected CBOR integer or byte string');
	}

	public readBytes(): Buffer {
		const { major, value } = this.#readTypeAndValue();
		if (major !== CBOR_MAJOR_TYPE_BYTE_STRING)
			throw new Error('Expected CBOR byte string');
		return this.#readBytes(value);
	}

	#readBytes(length: number): Buffer {
		const end = this.#offset + length;
		if (end > this.#data.length)
			throw new Error('CBOR byte string out of bounds');
		const result = this.#data.subarray(this.#offset, end);
		this.#offset = end;
		return result;
	}

	public skipItem(): void {
		const { major, value } = this.#readTypeAndValue();
		switch (major) {
			case CBOR_MAJOR_TYPE_UNSIGNED_INTEGER:
			case CBOR_MAJOR_TYPE_NEGATIVE_INTEGER:
			case CBOR_MAJOR_TYPE_FLOAT_SIMPLE:
				return;
			case CBOR_MAJOR_TYPE_BYTE_STRING:
			case CBOR_MAJOR_TYPE_TEXT_STRING:
				this.#skipBytes(value);
				return;
			case CBOR_MAJOR_TYPE_ARRAY:
				for (let i = 0; i < value; i++) {
					this.skipItem();
				}
				return;
			case CBOR_MAJOR_TYPE_MAP:
				for (let i = 0; i < value; i++) {
					this.skipItem();
					this.skipItem();
				}
				return;
			default:
				throw new Error('Unsupported CBOR item');
		}
	}

	#skipBytes(length: number): void {
		const end = this.#offset + length;
		if (end > this.#data.length)
			throw new Error('CBOR value out of bounds');
		this.#offset = end;
	}

	#readTypeAndValue(): { major: number; value: number; } {
		const first = this.#readByte();
		const major = Math.floor(first / CBOR_MAJOR_TYPE_DIVISOR);
		const additional = first % CBOR_MAJOR_TYPE_DIVISOR;
		return {
			major,
			value: this.#readValue(additional),
		};
	}

	#readValue(additional: number): number {
		if (additional < CBOR_ADDITIONAL_INFO_ONE_BYTE_VALUE)
			return additional;
		if (additional === CBOR_ADDITIONAL_INFO_ONE_BYTE_VALUE)
			return this.#readByte();
		if (additional === CBOR_ADDITIONAL_INFO_TWO_BYTE_VALUE)
			return this.#readUIntBE(2);
		if (additional === CBOR_ADDITIONAL_INFO_FOUR_BYTE_VALUE)
			return this.#readUIntBE(4);
		throw new Error('Unsupported CBOR length');
	}

	#readUIntBE(bytes: number): number {
		if (this.#offset + bytes > this.#data.length)
			throw new Error('CBOR integer out of bounds');
		const value = this.#data.readUIntBE(this.#offset, bytes);
		this.#offset += bytes;
		return value;
	}

	#readByte(): number {
		if (this.#offset >= this.#data.length)
			throw new Error('CBOR read out of bounds');
		const value = this.#data[this.#offset] ?? 0;
		this.#offset += 1;
		return value;
	}
}

function HasAuthenticatorFlag(flags: number, flag: number): boolean {
	return Math.floor(flags / flag) % 2 === 1;
}
