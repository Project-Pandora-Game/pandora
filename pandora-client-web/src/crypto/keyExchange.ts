import type { IAccountCryptoKey } from 'pandora-common';
import { ArrayToBase64, Base64ToArray, HashSHA512Base64 } from './helpers';
import { SymmetricEncryption } from './symmetric';

const subtle = globalThis.crypto.subtle;

const ENCRYPTION_SALT = 'pandora-encryption-salt';
const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' };
const ECDH_KEY_PRIVATE_USAGES: KeyUsage[] = ['deriveKey'];
const ECDH_KEY_PUBLIC_USAGES: KeyUsage[] = [];
const ECDH_KEY_USAGES: KeyUsage[] = [...ECDH_KEY_PRIVATE_USAGES, ...ECDH_KEY_PUBLIC_USAGES];

export class KeyExchange {
	#privateKey: CryptoKey;
	#publicKey: CryptoKey;

	constructor(privateKey: CryptoKey, publicKey: CryptoKey) {
		this.#privateKey = privateKey;
		this.#publicKey = publicKey;
	}

	public async deriveKey(publicKeyData: string): Promise<SymmetricEncryption> {
		const publicKey = await ImportSpki(publicKeyData);
		return SymmetricEncryption.derive(publicKey, this.#privateKey);
	}

	public async exportPublicKey(): Promise<string> {
		const publicKey = await subtle.exportKey('spki', this.#publicKey);
		return ArrayToBase64(new Uint8Array(publicKey));
	}

	public async export(password: string): Promise<IAccountCryptoKey> {
		const salt = crypto.getRandomValues(new Uint8Array(32));
		const enc = await SymmetricEncryption.generate({ password, salt });
		const { iv, encypted } = await enc.wrapKey(this.#privateKey);
		return {
			publicKey: await this.exportPublicKey(),
			salt: ArrayToBase64(salt),
			iv,
			encyptedPrivateKey: encypted,
		};
	}

	public static async import({ publicKey, iv, salt, encyptedPrivateKey }: IAccountCryptoKey, password: string): Promise<KeyExchange> {
		const enc = await SymmetricEncryption.generate({ password, salt: Base64ToArray(salt) });
		const privateKey = await enc.unwrapKey(iv, encyptedPrivateKey, ECDH_PARAMS, ECDH_KEY_PRIVATE_USAGES);
		return new KeyExchange(privateKey, await ImportSpki(publicKey));
	}

	public static async generate(): Promise<KeyExchange> {
		const keyPair = await subtle.generateKey(ECDH_PARAMS, true, ECDH_KEY_USAGES);
		return new KeyExchange(keyPair.privateKey, keyPair.publicKey);
	}

	public static async generateKeyPassword(username: string, password: string): Promise<string> {
		return await HashSHA512Base64(ENCRYPTION_SALT + username + password);
	}
}

async function ImportSpki(publicKey: string): Promise<CryptoKey> {
	return await subtle.importKey('spki', Base64ToArray(publicKey), ECDH_PARAMS, true, ECDH_KEY_PUBLIC_USAGES);
}
