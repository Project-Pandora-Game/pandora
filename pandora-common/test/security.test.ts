import { describe, expect, it } from '@jest/globals';
import { GenerateHighEntropyToken } from '../src/security.ts';
import { HIGH_ENTROPY_TOKEN_ALPHABET, HIGH_ENTROPY_TOKEN_LENGTH, IsHighEntropyToken } from '../src/validation.ts';

describe('GenerateHighEntropyToken', () => {
	it('generates distinct 80-bit tokens using the human-readable alphabet', () => {
		expect(HIGH_ENTROPY_TOKEN_ALPHABET).toHaveLength(32);
		expect(new Set(HIGH_ENTROPY_TOKEN_ALPHABET).size).toBe(32);
		const tokens = Array.from({ length: 100 }, () => GenerateHighEntropyToken());
		expect(new Set(tokens).size).toBe(tokens.length);
		for (const token of tokens) {
			expect(token).toHaveLength(HIGH_ENTROPY_TOKEN_LENGTH);
			expect(token).toMatch(/^[2-9A-HJ-NP-Z]{16}$/);
			expect(IsHighEntropyToken(token)).toBe(true);
		}
	});
});
