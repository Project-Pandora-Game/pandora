import { renderHook } from '@testing-library/react';
import { noop } from 'lodash-es';
import { act } from 'react';
import { useErrorHandler } from '../../src/common/useErrorHandler.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('useErrorHandler', () => {
	let consoleError: jest.Spied<typeof console.error>;

	beforeAll(() => {
		consoleError = jest.spyOn(console, 'error');
		consoleError.mockImplementation(noop);
	});

	afterAll(() => {
		consoleError.mockRestore();
	});

	it('should throw an error that has been passed to it synchronously', () => {
		const error = new Error('Synchronous error');
		expect(() => renderHook(() => useErrorHandler(error))).toThrow(error);
	});

	it('should return an error handler callback which can be used to throw errors from async code', () => {
		const error = new Error('Async error');
		const { result } = renderHook(() => useErrorHandler());
		expect(() => {
			act(() => result.current(error));
		}).toThrow(error);
	});
});
