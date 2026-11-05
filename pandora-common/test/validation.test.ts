import { describe, expect, it } from '@jest/globals';
import { ClientDirectorySchema } from '../src/networking/api/directory_client/client_directory.ts';
import { FormatHighEntropyToken, HighEntropyTokenSchema, IsObject, NormalizeHighEntropyToken, ZodTrimedRegex } from '../src/validation.ts';

describe('Validation', () => {

	it('accepts only canonical network tokens and normalizes manually entered tokens', () => {
		const token = 'ABCDEFGHJKLMNPQR';
		const enteredToken = 'abcd - efgh  jklm-\tnpqr';
		expect(HighEntropyTokenSchema.safeParse(token).success).toBe(true);
		expect(HighEntropyTokenSchema.safeParse(enteredToken).success).toBe(false);
		expect(HighEntropyTokenSchema.parse(NormalizeHighEntropyToken(enteredToken))).toBe(token);
		expect(NormalizeHighEntropyToken(enteredToken)).toBe(token);
		expect(FormatHighEntropyToken(token)).toBe('ABCD-EFGH-JKLM-NPQR');
	});

	it('requires reset-confirm requests to carry a normalized token', () => {
		const schema = ClientDirectorySchema.passwordResetConfirm.request;
		const request = { username: 'test-user', passwordSha512: `${ 'a'.repeat(86) }==`, token: 'ABCD-EFGH-JKLM-NPQR' };
		expect(schema.safeParse(request).success).toBe(false);
		expect(schema.parse({ ...request, token: NormalizeHighEntropyToken(request.token) }).token).toBe('ABCDEFGHJKLMNPQR');
	});

	it('does not normalize Unicode case expansions into valid token characters', () => {
		for (const token of ['ABCDEFGHJKLMNPß', 'ſ'.repeat(16)]) {
			expect(NormalizeHighEntropyToken(token)).toBe(token);
			expect(HighEntropyTokenSchema.safeParse(NormalizeHighEntropyToken(token)).success).toBe(false);
		}
	});

	it.each(['012345', 'ABCDEFGHJKLMNPQ', 'ABCDEFGHJKLMNPQRR', 'ABCD-EFGH-JKLM-NP0R', 'ABCD-EFGH-JKLM-NP1R', 'ABCD-EFGH-JKLM-NPIR', 'ABCD-EFGH-JKLM-NPOR', 'ABCD_EFGH_JKLM_NPQR', 'ABCDEFGHJKLMNPß'])(
		'rejects invalid high-entropy token %p',
		(token) => {
			expect(HighEntropyTokenSchema.safeParse(token).success).toBe(false);
		},
	);

	describe('IsObject', () => {

		it('should return true for objects', () => {
			const obj = {};
			expect(IsObject(obj)).toBeTruthy();
		});

		it('should return false for null', () => {
			const obj = null;
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for arrays', () => {
			const obj: unknown[] = [];
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for numbers', () => {
			const obj = 1;
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for strings', () => {
			const obj = '1';
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for booleans', () => {
			const obj = true;
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for undefined', () => {
			const obj = undefined;
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for functions', () => {
			const obj = () => { /* NOOP */ };
			expect(IsObject(obj)).toBeFalsy();
		});

		it('should return false for symbols', () => {
			const obj = Symbol();
			expect(IsObject(obj)).toBeFalsy();
		});

	});

	describe('ZodTrimedRegex', () => {
		it.each([
			'',
			'a',
			'0123',
			'a a',
			'1 2 3 4 5 6 7 8 9',
			'1 2 3\t4 5\n6 7 8 9',
		])('Passes for %p', (value) => {
			expect(ZodTrimedRegex.test(value)).toBe(true);
		});

		it.each([
			' ',
			'a ',
			'a\t',
			'a\n',
			' b',
			'\tb',
			'\nb',
			' c ',
			' 0123',
			'0123 ',
			' 0123 ',
			' a a',
			'a a ',
			' a a ',
			' 1 2 3 4 5 6 7 8 9',
			'1 2 3 4 5 6 7 8 9 ',
			'  1 2 3 4 5 6 7 8 9  ',
		])('Fails for %p', (value) => {
			expect(ZodTrimedRegex.test(value)).toBe(false);
		});
	});
});
