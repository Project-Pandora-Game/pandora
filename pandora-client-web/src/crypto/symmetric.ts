import { Assert } from 'pandora-common';
import { ArrayToBase64, Base64ToArray, Decode, Encode, GenerateIV } from './helpers.ts';

const AES_GCM_PARAMS = { name: 'AES-GCM', length: 256 } as const;
const AES_GCM_KEY_USAGES: readonly KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'];
const PBKDF2_PARAMS = { name: 'PBKDF2', iterations: 100_000, hash: 'SHA-512' } as const;

function GetSubtle(): SubtleCrypto {
	const subtle = globalThis.crypto.subtle;
	Assert(subtle != null, 'Missing crypto.subtle support');
	return subtle;
}

export class SymmetricEncryption {
	#key: CryptoKey;

	private constructor(key: CryptoKey) {
		this.#key = key;
	}

	public async encrypt(text: string): Promise<string> {
		const { iv, alg } = GenerateIV();
		const encrypted = await GetSubtle().encrypt(alg, this.#key, Encode(text));
		return iv + ':' + ArrayToBase64(new Uint8Array(encrypted));
	}

	public async decrypt(text: string): Promise<string> {
		const [iv, encrypted] = text.split(':');
		const decrypted = await GetSubtle().decrypt(GenerateIV(iv).alg, this.#key, Base64ToArray(encrypted));
		return Decode(new Uint8Array(decrypted));
	}

	public async wrapKey(key: CryptoKey): Promise<{ iv: string; encrypted: string; }> {
		const { iv, alg } = GenerateIV();
		const encryptedKey = await GetSubtle().wrapKey('pkcs8', key, this.#key, alg);
		return { iv, encrypted: ArrayToBase64(new Uint8Array(encryptedKey)) };
	}

	public async unwrapKey(iv: string, key: string, params: RsaHashedImportParams | EcKeyImportParams, usage: KeyUsage[]): Promise<CryptoKey> {
		return await GetSubtle().unwrapKey('pkcs8', Base64ToArray(key), this.#key, GenerateIV(iv).alg, params, true, usage);
	}

	public static async generate(gen?: { password: string; salt: Uint8Array<ArrayBuffer>; }): Promise<SymmetricEncryption> {
		let key: CryptoKey | undefined;
		if (gen === undefined) {
			key = await GetSubtle().generateKey(AES_GCM_PARAMS, true, AES_GCM_KEY_USAGES);
		} else {
			const { password, salt } = gen;
			const pbkdf2 = await GetSubtle().importKey('raw', Encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
			key = await GetSubtle().deriveKey({
				...PBKDF2_PARAMS,
				salt,
			}, pbkdf2, AES_GCM_PARAMS, true, [...AES_GCM_KEY_USAGES]);
		}
		return new SymmetricEncryption(key);
	}

	public static async derive(publicKey: CryptoKey, privateKey: CryptoKey): Promise<SymmetricEncryption> {
		const sharedKey = await GetSubtle().deriveKey(
			{ name: 'ECDH', public: publicKey },
			privateKey,
			AES_GCM_PARAMS,
			true,
			[...AES_GCM_KEY_USAGES],
		);
		return new SymmetricEncryption(sharedKey);
	}
}
