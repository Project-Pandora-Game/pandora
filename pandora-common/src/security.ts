import { customAlphabet } from 'nanoid';
import { HIGH_ENTROPY_TOKEN_ALPHABET, HIGH_ENTROPY_TOKEN_LENGTH } from './validation.ts';

/** Static salt prepended before raw password during pre-hashing */
export const PASSWORD_PREHASH_SALT = 'pandora-password-salt:';

const generateHighEntropyToken = customAlphabet(HIGH_ENTROPY_TOKEN_ALPHABET, HIGH_ENTROPY_TOKEN_LENGTH);

/** Generate an 80-bit random code for short-lived, manually entered tokens. */
export function GenerateHighEntropyToken(): string {
	return generateHighEntropyToken();
}
