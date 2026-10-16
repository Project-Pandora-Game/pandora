import { verifyAuthenticationResponse, verifyRegistrationResponse, type VerifiedAuthenticationResponse, type VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { createHash, randomBytes } from 'crypto';
import { ACCOUNT_PASSKEYS_ALLOWED_ALGORITHMS, GetLogger, type AccountId } from 'pandora-common';
import type { IAccountPasskeyCredential } from 'pandora-common/networking/api/directory_client';
import { ENV } from '../config.ts';

const { PASSKEY_ALLOWED_ORIGINS, PASSKEY_RP_ID } = ENV;
const PASSKEY_ORIGINS = Array.from(new Set(
	PASSKEY_ALLOWED_ORIGINS
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean),
));
Object.freeze(PASSKEY_ORIGINS);

type ChallengePurpose = 'register' | 'login' | 'extendLogin' | 'sudo';

type ChallengeRecord = {
	accountId: AccountId | null;
	purpose: ChallengePurpose;
	created: number;
};

/** @see https://www.w3.org/TR/webauthn-3/#cryptographic-challenges */
const PASSKEY_CHALLENGE_BYTE_LENGTH = 32;
/** @see https://www.w3.org/TR/webauthn-3/#prf-extension */
const PASSKEY_PRF_SALT_BYTE_LENGTH = 32;
const CHALLENGE_TTL = 5 * 60_000;
const MAX_PASSKEY_CHALLENGES = 10_000;
const MAX_ANONYMOUS_LOGIN_CHALLENGES = 2_000;
const PASSKEY_PRF_SALT = Base64UrlEncode(createHash('sha256')
	.update(`project-pandora:passkey-prf:${PASSKEY_RP_ID}`, 'utf-8')
	.digest()
	.subarray(0, PASSKEY_PRF_SALT_BYTE_LENGTH));

/** Keep unauthenticated requests from evicting account-bound challenges. */
export class PasskeyChallengeStore {
	readonly #login = new Map<string, ChallengeRecord>();
	readonly #account = new Map<string, ChallengeRecord>();
	private readonly maxLogin: number;
	private readonly maxAccount: number;

	constructor(
		maxLogin: number,
		maxAccount: number,
	) {
		this.maxLogin = maxLogin;
		this.maxAccount = maxAccount;
	}

	public issue(accountId: AccountId | null, purpose: ChallengePurpose, now: number = Date.now()): string {
		const challenges = purpose === 'login' ? this.#login : this.#account;
		this.#pruneExpired(challenges, now);
		const capacity = purpose === 'login' ? this.maxLogin : this.maxAccount;
		if (challenges.size >= capacity) {
			// A saturated anonymous pool must not deny fresh logins globally.
			// Eviction remains within the same purpose's pool.
			const oldest = challenges.keys().next().value;
			if (oldest != null)
				challenges.delete(oldest);
		}

		let challenge: string;
		do {
			challenge = Base64UrlEncode(randomBytes(PASSKEY_CHALLENGE_BYTE_LENGTH));
		} while (this.#login.has(challenge) || this.#account.has(challenge));
		challenges.set(challenge, { accountId, purpose, created: now });
		return challenge;
	}

	public consume(challenge: string, accountId: AccountId, purpose: ChallengePurpose, now: number = Date.now()): boolean {
		const record = this.#login.get(challenge) ?? this.#account.get(challenge);
		this.#login.delete(challenge);
		this.#account.delete(challenge);
		return record != null &&
			(record.accountId == null || record.accountId === accountId) &&
			record.purpose === purpose &&
			now - record.created <= CHALLENGE_TTL;
	}

	#pruneExpired(challenges: Map<string, ChallengeRecord>, now: number): void {
		// Insertion order is issuance order. This costs O(expired), not O(active)
		// on every anonymous challenge start.
		for (const [challenge, record] of challenges) {
			if (now - record.created <= CHALLENGE_TTL)
				break;
			challenges.delete(challenge);
		}
	}
}

const Challenges = new PasskeyChallengeStore(MAX_ANONYMOUS_LOGIN_CHALLENGES, MAX_PASSKEY_CHALLENGES);

export function CreatePasskeyChallenge(accountId: AccountId | null, purpose: ChallengePurpose): string {
	return Challenges.issue(accountId, purpose);
}

export function GetPasskeyPrfSalt(): string {
	return PASSKEY_PRF_SALT;
}

export function ConsumePasskeyChallenge(challenge: string, accountId: AccountId, purpose: ChallengePurpose): boolean {
	return Challenges.consume(challenge, accountId, purpose);
}

export async function ValidatePasskeyRegistration(data: {
	accountId: AccountId;
	credentialId: string;
	clientDataJSON: string;
	attestationObject: string;
	authenticatorData: string;
	publicKeyAlgorithm?: number;
	publicKey: string;
	transports?: string[];
}): Promise<Extract<VerifiedRegistrationResponse, { verified: true; }>['registrationInfo'] | null> {
	try {
		const result = await verifyRegistrationResponse({
			response: {
				id: data.credentialId,
				rawId: data.credentialId,
				type: 'public-key',
				response: {
					clientDataJSON: data.clientDataJSON,
					attestationObject: data.attestationObject,
					authenticatorData: data.authenticatorData,
					transports: data.transports,
					publicKeyAlgorithm: data.publicKeyAlgorithm,
					publicKey: data.publicKey,
				},
				clientExtensionResults: {}, // Not actually used for verification
			},
			expectedChallenge(challenge) {
				return ConsumePasskeyChallenge(challenge, data.accountId, 'register');
			},
			expectedOrigin: PASSKEY_ORIGINS,
			expectedRPID: PASSKEY_RP_ID,
			expectedType: 'webauthn.create',
			requireUserPresence: true,
			requireUserVerification: true,
			supportedAlgorithmIDs: ACCOUNT_PASSKEYS_ALLOWED_ALGORITHMS.slice(),
		});
		if (!result.verified) {
			GetLogger('VerifyPasskeyAssertion').warning('Failed to verify passkey registration response');
			return null;
		}

		// Additionally verify that suppliced credential id matches attested one
		if (result.registrationInfo.credential.id !== data.credentialId)
			throw new Error('Attested credential id does not match supplied credential id');

		return result.registrationInfo;
	} catch (e) {
		GetLogger('ValidatePasskeyRegistration').warning('Failed to validate passkey registration response:', e);
		return null;
	}
}

export async function VerifyPasskeyAssertion(passkey: IAccountPasskeyCredential, data: {
	accountId: AccountId;
	clientDataJSON: string;
	authenticatorData: string;
	signature: string;
	purpose: Exclude<ChallengePurpose, 'register'>;
}): Promise<VerifiedAuthenticationResponse['authenticationInfo'] | null> {
	try {
		const result = await verifyAuthenticationResponse({
			response: {
				id: passkey.credentialId,
				rawId: passkey.credentialId,
				response: {
					clientDataJSON: data.clientDataJSON,
					authenticatorData: data.authenticatorData,
					signature: data.signature,
				},
				clientExtensionResults: {}, // Not actually used for verification
				type: 'public-key',
			},
			credential: {
				id: passkey.credentialId,
				publicKey: new Uint8Array(Base64UrlDecode(passkey.publicKey)),
				counter: passkey.signCount,
				transports: passkey.transports,
			},
			expectedChallenge(challenge) {
				return ConsumePasskeyChallenge(challenge, data.accountId, data.purpose);
			},
			expectedOrigin: PASSKEY_ORIGINS,
			expectedRPID: PASSKEY_RP_ID,
			expectedType: 'webauthn.get',
			requireUserVerification: true,
		});
		if (!result.verified) {
			GetLogger('VerifyPasskeyAssertion').warning('Failed to verify passkey assertion');
			return null;
		}

		return result.authenticationInfo;
	} catch (e) {
		GetLogger('VerifyPasskeyAssertion').warning('Failed to verify passkey assertion:', e);
		return null;
	}
}

export function Base64UrlEncode(data: Buffer | Uint8Array): string {
	return Buffer.from(data).toString('base64url');
}

export function Base64UrlDecode(data: string): Buffer {
	return Buffer.from(data, 'base64url');
}
