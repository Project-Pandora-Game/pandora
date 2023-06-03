import { SecretManager } from 'pandora-common';
import { CipherGCMTypes, createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createHmac } from 'crypto';

const SYMMETRIC_ALGORITHM = 'aes-256-gcm' as const satisfies CipherGCMTypes;
const SYMMETRIC_IV_LENGTH = 16;

const HMAC_ALGORITHM = 'sha256' as const;
const HMAC_SALT_LENGTH = 16;

export const ShardSecretManager = new class ShardSecretManager implements SecretManager {
	#key: Buffer | undefined;

	public initializeKey(key: string): void {
		this.#key = Buffer.from(key, 'utf8');
	}

	public isValid(secret: string): boolean {
		return this.decrypt(secret) != null;
	}

	public decrypt(secret?: string | undefined): string | undefined {
		if (!secret || this.#key == null) {
			return undefined;
		}
		try {
			const buffer = Buffer.from(secret, 'base64');
			if (buffer.length < SYMMETRIC_IV_LENGTH) {
				return undefined;
			}
			const iv = buffer.subarray(0, SYMMETRIC_IV_LENGTH);
			const encrypted = buffer.subarray(SYMMETRIC_IV_LENGTH);
			const decipher = createDecipheriv(SYMMETRIC_ALGORITHM, this.#key, iv);
			const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
			return decrypted.toString('utf8');
		} catch {
			return undefined;
		}
	}

	public encrypt(secret: string): string {
		if (this.#key == null) {
			throw new Error('Secret manager key is not set');
		}
		const iv = randomBytes(SYMMETRIC_IV_LENGTH);
		const cipher = createCipheriv(SYMMETRIC_ALGORITHM, this.#key, iv);
		const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
		return Buffer.concat([iv, encrypted]).toString('base64');
	}

	public verify(secret: string, password: string): boolean {
		if (this.#key == null) {
			return false;
		}
		const buffer = Buffer.from(secret, 'base64');
		if (buffer.length < HMAC_SALT_LENGTH) {
			return false;
		}
		const salt = buffer.subarray(0, HMAC_SALT_LENGTH);
		const hash = buffer.subarray(HMAC_SALT_LENGTH);
		const hash2 = this._hash(password, salt);
		return hash.equals(hash2);
	}

	public hash(password: string): string {
		const salt = randomBytes(HMAC_SALT_LENGTH);
		const hash = this._hash(password, salt);
		return Buffer.concat([salt, hash]).toString('base64');
	}

	private _hash(password: string, salt: Buffer): Buffer {
		if (this.#key == null) {
			throw new Error('Secret manager key is not set');
		}
		const hash = createHmac(HMAC_ALGORITHM, this.#key);
		hash.update(salt);
		hash.update(password);
		return hash.digest();
	}
};
