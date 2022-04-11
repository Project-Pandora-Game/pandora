import { renderHook, act } from '@testing-library/react-hooks';
import { observable, Observable, useObservable } from '../src/observable';

describe('Observable', () => {
	type T = { mockValue: string; };
	const defValue: T = { mockValue: 'mock' };
	const updated: T = { mockValue: 'updated' };
	let mockObservable: Observable<T>;

	beforeEach(() => mockObservable = new Observable<T>(defValue));

	describe('get value()', () => {
		it('should return default value', () => {
			expect(mockObservable.value).toEqual(defValue);
		});
	});

	describe('set value()', () => {
		it('should return current value', () => {
			mockObservable.value = updated;
			expect(mockObservable.value).toEqual(updated);
		});

		it('should notify observers about the update', () => {
			const sub = jest.fn();
			mockObservable.subscribe(sub);
			mockObservable.value = updated;
			expect(sub).toBeCalledTimes(1);
			expect(sub).toBeCalledWith(updated);
		});

		it('should not notify deleted observers', () => {
			const sub = jest.fn();
			const handle = mockObservable.subscribe(sub);
			mockObservable.value = updated;
			expect(sub).toBeCalledTimes(1);
			expect(sub).toBeCalledWith(updated);
			handle(); //delete me
			mockObservable.value = defValue;
			expect(sub).toBeCalledTimes(1);
		});
	});
	describe('subscribe()', () => {
		it('should return a handler', () => {
			expect(typeof mockObservable.subscribe(jest.fn())).toBe('function');
		});
	});
});

describe('useObservable()', () => {
	type T = { mockValue: string; };
	const defValue: T = { mockValue: 'mock' };
	const updated: T = { mockValue: 'updated' };
	const mockObservable = new Observable<T>(defValue);
	const { result, rerender } = renderHook(() => useObservable(mockObservable));
	beforeEach(() => rerender());

	it('should return observable\'s default value', () => {

		expect(result.current).toBe(defValue);
	});

	it('should return observable\'s updated value after assignment', () => {
		act(() => {
			mockObservable.value = updated;
		});
		expect(result.current).toBe(updated);
	});
});

// decorator use case isn\'t tested due to TS & babel not working the same
describe('@observable()', () => {
	it.todo('decorator use case isn\'t tested due to TS & babel not working the same');

	it('should return decorator factory function', () => {
		expect(typeof observable()).toBe('function');
		const mock = {
			test: 'one',
			test2: 2,
			emit: jest.fn(),
		};
		const decorator = observable();
		// @ts-expect-error: mock is not an ObservableClass
		decorator(mock, 'test');
		mock.test = 'updated';
		expect(mock.emit).lastCalledWith('test', 'updated');
		expect(mock.test).toBe('updated');
		mock.test2 = 3;
		expect(mock.emit).toBeCalledTimes(1);
		expect(mock.emit).not.toBeCalledTimes(2);
	});
});
