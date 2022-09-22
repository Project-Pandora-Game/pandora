import { Encode, ArrayToBase64, Base64ToArray, Decode, GenerateIV } from './helpers';

const subtle = globalThis.crypto.subtle;

const AES_GCM_PARAMS = { name: 'AES-GCM', length: 256 };
const AES_GCM_KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'];
const PBKDF2_PARAMS = { name: 'PBKDF2', iterations: 100_000, hash: 'SHA-512' };

export default class SymmetricEncryption {
	#key: CryptoKey;

	private constructor(key: CryptoKey) {
		this.#key = key;
	}

	public async encrypt(text: string): Promise<string> {
		const { iv, alg } = GenerateIV();
		const encrypted = await subtle.encrypt(alg, this.#key, Encode(text));
		return iv + ':' + ArrayToBase64(new Uint8Array(encrypted));
	}

	public async decrypt(text: string): Promise<string> {
		const [iv, encrypted] = text.split(':');
		const decrypted = await subtle.decrypt(GenerateIV(iv).alg, this.#key, Base64ToArray(encrypted));
		return Decode(new Uint8Array(decrypted));
	}

	public async wrapKey(key: CryptoKey): Promise<string> {
		const { iv, alg } = GenerateIV();
		const encryptedKey = await subtle.wrapKey('pkcs8', key, this.#key, alg);
		return iv + ':' + ArrayToBase64(new Uint8Array(encryptedKey));
	}

	public async unwrapKey(iv: string, key: string, params: RsaHashedImportParams | EcKeyImportParams, usage: KeyUsage[]): Promise<CryptoKey> {
		return await subtle.unwrapKey('pkcs8', Base64ToArray(key), this.#key, GenerateIV(iv).alg, params, true, usage);
	}

	public static async generate(gen?: { password: string, salt: Uint8Array; }): Promise<SymmetricEncryption> {
		let key: CryptoKey | undefined;
		if (gen === undefined) {
			key = await subtle.generateKey(AES_GCM_PARAMS, true, AES_GCM_KEY_USAGES);
		} else {
			const { password, salt } = gen;
			const pbkdf2 = await subtle.importKey('raw', Encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
			key = await subtle.deriveKey({
				...PBKDF2_PARAMS,
				salt,
			}, pbkdf2, AES_GCM_PARAMS, true, AES_GCM_KEY_USAGES);
		}
		return new SymmetricEncryption(key);
	}

	public static async derive(publicKey: CryptoKey, privateKey: CryptoKey): Promise<SymmetricEncryption> {
		const sharedKey = await subtle.deriveKey(
			{ name: 'ECDH', public: publicKey },
			privateKey,
			AES_GCM_PARAMS,
			true,
			AES_GCM_KEY_USAGES,
		);
		return new SymmetricEncryption(sharedKey);
	}
}
