import { IsObject } from '../src/validation';

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
});
