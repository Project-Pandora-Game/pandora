import { ACCOUNT_PASSKEYS_ALLOWED_ALGORITHMS, type IClientDirectoryNormalResult } from 'pandora-common';
import { ArrayToBase64, ArrayToBase64Url, Base64UrlToArray } from './helpers.ts';

type PasskeyAssertionStart = {
	rpId: string;
	challenge: string;
	credentials?: { id: string; type: 'public-key'; transports?: string[]; }[];
	prfSalt: string;
};
type PasskeyRegisterStart = Extract<IClientDirectoryNormalResult['passkeyRegisterStart'], { result: 'ok'; }>;

/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_TEXT_STRING = 3;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_BYTE_STRING = 2;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_ADDITIONAL_INFO_ONE_BYTE_LENGTH = 24;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_ADDITIONAL_INFO_TWO_BYTE_LENGTH = 25;
/** @see https://www.rfc-editor.org/rfc/rfc8949.html#section-3.1 */
const CBOR_MAJOR_TYPE_SHIFT = 5;
const CBOR_ADDITIONAL_INFO_MASK = 0x1f;

export type PasskeyAssertionOptions = {
	mediation?: CredentialMediationRequirement;
	signal?: AbortSignal;
};

export type PasskeyAssertionResult = {
	credentialId: string;
	clientDataJSON: string;
	authenticatorData: string;
	signature: string;
	wrappingSecret: string;
};

export type PasskeyRegistrationResult = {
	credentialId: string;
	publicKeyAlgorithm?: number;
	publicKey: string;
	clientDataJSON: string;
	authenticatorData: string;
	attestationObject: string;
	transports?: string[];
	wrappingSecret: string;
};

export function IsPasskeySupported(): boolean {
	return globalThis.PublicKeyCredential != null && navigator.credentials != null;
}

export async function IsPasskeyConditionalMediationSupported(): Promise<boolean> {
	if (!IsPasskeySupported() || PublicKeyCredential.isConditionalMediationAvailable == null)
		return false;

	return await PublicKeyCredential.isConditionalMediationAvailable();
}

export async function SignalUnknownPasskeyCredential(rpId: string, credentialId: string): Promise<void> {
	if (PublicKeyCredential.signalUnknownCredential == null)
		return;

	try {
		await PublicKeyCredential.signalUnknownCredential({
			credentialId,
			rpId,
		});
	} catch {
		// Browser/passkey-provider cleanup is best-effort and should not affect login UX.
	}
}

export async function SignalAllAcceptedPasskeyCredentials(rpId: string, userId: string, passkeys: { credentialId: string; }[]): Promise<void> {
	if (PublicKeyCredential.signalAllAcceptedCredentials == null)
		return;

	try {
		await PublicKeyCredential.signalAllAcceptedCredentials({
			allAcceptedCredentialIds: passkeys.map((passkey) => passkey.credentialId),
			rpId,
			userId,
		});
	} catch {
		// Browser/passkey-provider cleanup is best-effort and should not affect login UX.
	}
}

export async function SignalCurrentPasskeyUserDetails(rpId: string, userId: string, name: string, displayName: string): Promise<void> {
	if (PublicKeyCredential.signalCurrentUserDetails == null)
		return;

	try {
		await PublicKeyCredential.signalCurrentUserDetails({
			displayName,
			name,
			rpId,
			userId,
		});
	} catch {
		// Browser/passkey-provider cleanup is best-effort and should not affect login UX.
	}
}

export async function GetPasskeyAssertion(start: PasskeyAssertionStart, options?: PasskeyAssertionOptions): Promise<PasskeyAssertionResult> {
	const publicKey: PublicKeyCredentialRequestOptions = {
		challenge: Base64UrlToArray(start.challenge),
		rpId: start.rpId,
		userVerification: 'required',
		extensions: {
			prf: {
				eval: {
					first: Base64UrlToArray(start.prfSalt),
				},
			},
		},
	};
	const allowedCredentials = start.credentials ?? [];
	if (allowedCredentials.length > 0) {
		publicKey.allowCredentials = allowedCredentials.map((allowedCredential) => ({
			...allowedCredential,
			id: Base64UrlToArray(allowedCredential.id),
			transports: allowedCredential.transports as AuthenticatorTransport[] | undefined,
		}));
	}

	const credential = await navigator.credentials.get({
		publicKey,
		mediation: options?.mediation,
		signal: options?.signal,
	});

	if (!(credential instanceof PublicKeyCredential) || !(credential.response instanceof AuthenticatorAssertionResponse) || credential.type !== 'public-key')
		throw new Error('Unexpected passkey assertion response');

	const prf = credential.getClientExtensionResults();

	return {
		credentialId: ArrayToBase64Url(credential.rawId),
		clientDataJSON: ArrayToBase64Url(credential.response.clientDataJSON),
		authenticatorData: ArrayToBase64Url(credential.response.authenticatorData),
		signature: ArrayToBase64Url(credential.response.signature),
		wrappingSecret: GetPrfWrappingSecret(prf),
	};
}

export async function CreatePasskeyCredential(start: PasskeyRegisterStart): Promise<PasskeyRegistrationResult> {
	const credential = await navigator.credentials.create({
		publicKey: {
			challenge: Base64UrlToArray(start.challenge),
			rp: {
				name: 'Pandora',
				id: start.rpId,
			},
			user: {
				id: Base64UrlToArray(start.user.id),
				name: start.user.name,
				displayName: start.user.displayName,
			},
			pubKeyCredParams: ACCOUNT_PASSKEYS_ALLOWED_ALGORITHMS.map((alg): PublicKeyCredentialParameters => ({ type: 'public-key', alg })),
			authenticatorSelection: {
				residentKey: 'required',
				userVerification: 'required',
			},
			excludeCredentials: start.excludeCredentials.map((excludedCredential) => ({
				...excludedCredential,
				id: Base64UrlToArray(excludedCredential.id),
				transports: excludedCredential.transports as AuthenticatorTransport[] | undefined,
			})),
			extensions: {
				prf: {
					eval: {
						first: Base64UrlToArray(start.prfSalt),
					},
				},
			},
		},
	});

	if (!(credential instanceof PublicKeyCredential) || !(credential.response instanceof AuthenticatorAttestationResponse) || credential.type !== 'public-key')
		throw new Error('Unexpected passkey registration response');

	const publicKey = credential.response.getPublicKey();
	if (publicKey == null)
		throw new Error('Browser did not expose passkey public key');

	const transports = credential.response.getTransports?.() as AuthenticatorTransport[] | undefined;
	const prf = credential.getClientExtensionResults();
	const wrappingSecret = GetPrfWrappingSecretOrNull(prf) ?? await GetPrfSecretForNewCredential(start, {
		id: credential.rawId,
		type: 'public-key',
		transports,
	});

	return {
		credentialId: ArrayToBase64Url(credential.rawId),
		publicKeyAlgorithm: credential.response.getPublicKeyAlgorithm?.(),
		publicKey: ArrayToBase64Url(publicKey),
		clientDataJSON: ArrayToBase64Url(credential.response.clientDataJSON),
		attestationObject: ArrayToBase64Url(credential.response.attestationObject),
		authenticatorData: ArrayToBase64Url(GetAuthenticatorData(credential.response)),
		transports,
		wrappingSecret,
	};
}

async function GetPrfSecretForNewCredential(start: PasskeyRegisterStart, credential: PublicKeyCredentialDescriptor): Promise<string> {
	const assertion = await navigator.credentials.get({
		publicKey: {
			challenge: Base64UrlToArray(start.challenge),
			rpId: start.rpId,
			allowCredentials: [credential],
			userVerification: 'required',
			extensions: {
				prf: {
					eval: {
						first: Base64UrlToArray(start.prfSalt),
					},
				},
			},
		},
	});

	if (!(assertion instanceof PublicKeyCredential) || !(assertion.response instanceof AuthenticatorAssertionResponse))
		throw new Error('Unexpected passkey PRF assertion response');

	const prf = assertion.getClientExtensionResults();
	return GetPrfWrappingSecret(prf);
}

function GetPrfWrappingSecret(prf: AuthenticationExtensionsClientOutputs): string {
	const wrappingSecret = GetPrfWrappingSecretOrNull(prf);
	if (wrappingSecret == null)
		throw new Error('Passkey PRF extension is required for passwordless DM key unlock');

	return wrappingSecret;
}

function GetPrfWrappingSecretOrNull(prf: AuthenticationExtensionsClientOutputs): string | null {
	const { prf: prfOutput } = prf;
	const first = prfOutput?.results?.first;
	if (first == null)
		return null;
	if (first instanceof ArrayBuffer)
		return ArrayToBase64(new Uint8Array(first));

	return ArrayToBase64(new Uint8Array(first.buffer, first.byteOffset, first.byteLength));
}

function GetAuthenticatorData(response: AuthenticatorAttestationResponse): ArrayBuffer {
	const authenticatorData = response.getAuthenticatorData?.();
	if (authenticatorData != null) {
		return authenticatorData;
	}

	// WebAuthn attestationObject is a CBOR map. Some browsers do not expose
	// getAuthenticatorData(), so extract the required authData byte string.
	const attestation = new Uint8Array(response.attestationObject);
	const authDataIndex = FindCborTextKey(attestation, 'authData');
	if (authDataIndex < 0)
		throw new Error('Unable to find authenticator data');

	const { major, additional } = ParseCborInitialByte(attestation[authDataIndex] ?? 0);
	if (major !== CBOR_MAJOR_TYPE_BYTE_STRING)
		throw new Error('Unsupported authenticator data encoding');

	if (additional === CBOR_ADDITIONAL_INFO_ONE_BYTE_LENGTH) {
		const length = attestation[authDataIndex + 1];
		return attestation.slice(authDataIndex + 2, authDataIndex + 2 + length).buffer;
	}
	if (additional === CBOR_ADDITIONAL_INFO_TWO_BYTE_LENGTH) {
		const length = attestation[authDataIndex + 1] * 256 + attestation[authDataIndex + 2];
		return attestation.slice(authDataIndex + 3, authDataIndex + 3 + length).buffer;
	}
	throw new Error('Unsupported authenticator data encoding');
}

function FindCborTextKey(data: Uint8Array, key: string): number {
	const encodedKey = new TextEncoder().encode(key);
	for (let i = 0; i < data.length - encodedKey.length - 1; i++) {
		const { major, additional } = ParseCborInitialByte(data[i] ?? 0);
		if (major !== CBOR_MAJOR_TYPE_TEXT_STRING || additional !== encodedKey.length)
			continue;
		let matches = true;
		for (let j = 0; j < encodedKey.length; j++) {
			if (data[i + 1 + j] !== encodedKey[j]) {
				matches = false;
				break;
			}
		}
		if (matches)
			return i + 1 + encodedKey.length;
	}
	return -1;
}

function ParseCborInitialByte(byte: number): { major: number; additional: number; } {
	return {
		// eslint-disable-next-line no-bitwise -- CBOR stores the major type in the high 3 bits.
		major: byte >> CBOR_MAJOR_TYPE_SHIFT,
		// eslint-disable-next-line no-bitwise -- CBOR stores additional info in the low 5 bits.
		additional: byte & CBOR_ADDITIONAL_INFO_MASK,
	};
}
