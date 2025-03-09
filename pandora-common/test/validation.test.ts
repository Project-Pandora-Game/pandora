import { IsObject, ZodTrimedRegex } from '../src/validation.ts';

describe('Validation', () => {

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
