import { Assert, type IAccountCryptoKey } from 'pandora-common';
import { ArrayToBase64, Base64ToArray, HashSHA512Base64 } from './helpers.ts';
import { SymmetricEncryption } from './symmetric.ts';

function GetSubtle(): SubtleCrypto {
	const subtle = globalThis.crypto.subtle;
	Assert(subtle != null, 'Missing crypto.subtle support');
	return subtle;
}

const ENCRYPTION_SALT = 'pandora-encryption-salt';
const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' } as const;
const ECDH_KEY_PRIVATE_USAGES: readonly KeyUsage[] = ['deriveKey'];
const ECDH_KEY_PUBLIC_USAGES: readonly KeyUsage[] = [];
const ECDH_KEY_USAGES: readonly KeyUsage[] = [...ECDH_KEY_PRIVATE_USAGES, ...ECDH_KEY_PUBLIC_USAGES];

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
		const publicKey = await GetSubtle().exportKey('spki', this.#publicKey);
		return ArrayToBase64(new Uint8Array(publicKey));
	}

	public async export(password: string): Promise<IAccountCryptoKey> {
		const salt = crypto.getRandomValues(new Uint8Array(32));
		const enc = await SymmetricEncryption.generate({ password, salt });
		const { iv, encrypted } = await enc.wrapKey(this.#privateKey);
		return {
			publicKey: await this.exportPublicKey(),
			salt: ArrayToBase64(salt),
			iv,
			encryptedPrivateKey: encrypted,
		};
	}

	/** Tests that the public and private key pairs match */
	public async selfTest(): Promise<boolean> {
		// Generate another random keypair
		const otherCrypto = await KeyExchange.generate();

		// Generate symmetric keys the two ways
		const myKey = await this.deriveKey(await otherCrypto.exportPublicKey());
		const theirKey = await otherCrypto.deriveKey(await this.exportPublicKey());

		const testData = 'test-data';

		// Encrypt and decrypt
		const encrypted = await myKey.encrypt(testData);
		const decrypted = await theirKey.decrypt(encrypted);

		return decrypted === testData;
	}

	public static async import({ publicKey, iv, salt, encryptedPrivateKey }: IAccountCryptoKey, password: string): Promise<KeyExchange> {
		const enc = await SymmetricEncryption.generate({ password, salt: Base64ToArray(salt) });
		const privateKey = await enc.unwrapKey(iv, encryptedPrivateKey, ECDH_PARAMS, [...ECDH_KEY_PRIVATE_USAGES]);
		return new KeyExchange(privateKey, await ImportSpki(publicKey));
	}

	public static async generate(): Promise<KeyExchange> {
		const keyPair = await GetSubtle().generateKey(ECDH_PARAMS, true, ECDH_KEY_USAGES);
		return new KeyExchange(keyPair.privateKey, keyPair.publicKey);
	}

	public static async generateKeyPassword(username: string, password: string): Promise<string> {
		return await HashSHA512Base64(`${ENCRYPTION_SALT}:${username.toLowerCase()}:${password}`);
	}

	/** Old variant only for unlocking old keys. */
	public static async generateKeyPasswordOld(username: string, password: string): Promise<string> {
		return await HashSHA512Base64(ENCRYPTION_SALT + username + password);
	}
}

async function ImportSpki(publicKey: string): Promise<CryptoKey> {
	return await GetSubtle().importKey('spki', Base64ToArray(publicKey), ECDH_PARAMS, true, [...ECDH_KEY_PUBLIC_USAGES]);
}
