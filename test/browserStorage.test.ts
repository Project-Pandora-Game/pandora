import { renderHook, act } from '@testing-library/react-hooks';
import { BrowserStorage, useBrowserStorage } from '../src/browserStorage';

type T = { mockValue: string; };
const mockDefault: T = { mockValue: 'mockValue' };
const mockUpdate: T = { mockValue: 'sth-different' };
const mockValidate = jest.fn(() => true);
const NAME = 'mockname';

let mockStorage: BrowserStorage<T>;
describe('BrowserStorage', () => {

	describe('create()', () => {
		beforeEach(() => {
			mockStorage = BrowserStorage.create<T>(NAME, mockDefault, mockValidate);
		});

		it('should create or return a BrowserStorage object', () => {
			expect(mockStorage).toBeInstanceOf(BrowserStorage);
		});

		it('should not return null or undefined', () => {
			expect(mockStorage).not.toBeNull();
			expect(mockStorage).not.toBeUndefined();
		});
	});
});

describe('useBrowserStorage()', () => {
	const { result, rerender } = renderHook(() => useBrowserStorage<T>(NAME, mockDefault, mockValidate));
	beforeEach(() => rerender());

	it('should return an array with two value', () => {
		expect(result.current.length).toBe(2);
	});

	describe('return value[0]', () => {
		it('should be defaultValue', () => {
			expect(result.current[0]).toBe(mockDefault);
		});

		it('should not set localStorage on default value', () => {
			expect(localStorage.getItem(`pandora.${NAME}`)).toBeNull();
		});
	});

	describe('return value[1]', () => {
		it('should be a function', () => {
			expect(typeof result.current[1]).toBe('function');
		});

		it('return value 1 should be a setValue function)', () => {
			act(() => result.current[1](mockUpdate));
			expect(result.current[0]).toBe(mockUpdate);
		});

		it('should set updated value to localStorage', () => {
			expect(localStorage.getItem(`pandora.${NAME}`)).toBe(JSON.stringify(mockUpdate));
		});

		it('should delete from localStorage if passed undefined', () => {
			expect(localStorage.getItem(`pandora.${NAME}`)).not.toBeNull();
			// @ts-expect-error: undefined is not of type T
			act(() => result.current[1](undefined));
			expect(localStorage.getItem(`pandora.${NAME}`)).toBeNull();
		});
	});

});
