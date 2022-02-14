import { IsObject, CreateStringValidator, IStringValidationOptions } from '../src/validation';

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

	describe('CreateStringValidator', () => {

		const stringValidation = (str: unknown, options?: IStringValidationOptions) => {
			return CreateStringValidator(options)(str);
		};

		it('should return true for strings', () => {
			const str = '1';
			expect(stringValidation(str)).toBeTruthy();
		});

		it('should return false for null', () => {
			const str = null;
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for undefined', () => {
			const str = undefined;
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for numbers', () => {
			const str = 1;
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for booleans', () => {
			const str = true;
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for functions', () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			const str = () => { };
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for symbols', () => {
			const str = Symbol();
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for arrays', () => {
			const str: unknown[] = [];
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for objects', () => {
			const str = {};
			expect(stringValidation(str)).toBeFalsy();
		});

		it('should return false for strings with minLength', () => {
			const str = '1';
			expect(stringValidation(str, { minLength: 2 })).toBeFalsy();
		});

		it('should return false for strings with maxLength', () => {
			const str = '1';
			expect(stringValidation(str, { maxLength: 0 })).toBeFalsy();
		});

		it('should return false for strings with minLength and maxLength', () => {
			const str = '1';
			expect(stringValidation(str, { minLength: 2, maxLength: 0 })).toBeFalsy();
		});

		it('should return true for strings with minLength', () => {
			const str = '1';
			expect(stringValidation(str, { minLength: 1 })).toBeTruthy();
		});

		it('should return true for strings with maxLength', () => {
			const str = '1';
			expect(stringValidation(str, { maxLength: 1 })).toBeTruthy();
		});

		it('should return true for strings with minLength and maxLength', () => {
			const str = '1';
			expect(stringValidation(str, { minLength: 1, maxLength: 1 })).toBeTruthy();
		});

		it('should return true for strings with regex', () => {
			const str = '1';
			expect(stringValidation(str, { regex: /^[0-9]+$/ })).toBeTruthy();
		});

		it('should return false for strings with regex', () => {
			const str = 'a';
			expect(stringValidation(str, { regex: /^[0-9]+$/ })).toBeFalsy();
		});

	});
});
