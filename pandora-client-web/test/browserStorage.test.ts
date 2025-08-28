import { renderHook, RenderHookResult } from '@testing-library/react';
import { act } from 'react';
import * as z from 'zod';
import { BrowserStorage, useBrowserStorage } from '../src/browserStorage.ts';

const MockDataSchema = z.object({
	mockValue: z.string(),
});
type MockData = z.infer<typeof MockDataSchema>;
const mockDefault: MockData = Object.freeze({ mockValue: 'mockValue' });
const mockUpdate: MockData = Object.freeze({ mockValue: 'sth-different' });

const NAME = 'mockname';

let mockStorage: BrowserStorage<MockData>;
describe('BrowserStorage', () => {

	describe('create()', () => {
		beforeEach(() => {
			mockStorage = BrowserStorage.create<MockData>(NAME, mockDefault, MockDataSchema);
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
	let result: RenderHookResult<[MockData, (t: MockData) => void], unknown>['result'];

	beforeEach(() => {
		result = renderHook(() => useBrowserStorage<MockData>(NAME, mockDefault, MockDataSchema)).result;
	});

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
