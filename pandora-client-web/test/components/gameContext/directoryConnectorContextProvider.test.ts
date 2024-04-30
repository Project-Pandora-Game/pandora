import { act } from 'react';
import { RenderHookResult } from '@testing-library/react';
import { IDirectoryClientChangeEvents } from 'pandora-common';
import {
	useAuthToken,
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../src/components/gameContext/directoryConnectorContextProvider';
import { MockAccountInfo, MockAuthToken, MockDirectoryConnector } from '../../mocks/networking/mockDirectoryConnector';
import { ProvidersProps, RenderHookWithProviders } from '../../testUtils';

const directoryChangeEvents: IDirectoryClientChangeEvents[] = [
	'characterList',
	'shardList',
	'spaceList',
];

describe('DirectoryConnectorContextProvider', () => {
	let directoryConnector: MockDirectoryConnector;

	beforeEach(() => {
		directoryConnector = new MockDirectoryConnector();
	});

	describe('useDirectoryConnector', () => {
		it('should return the directory connector', () => {
			const { result: { current } } = renderHookWithTestProviders(useDirectoryConnector);
			expect(current).toBe(directoryConnector);
		});
	});

	describe('useDirectoryChangeListener', () => {
		const callback = jest.fn();

		it.each(directoryChangeEvents)('should fire the %p callback immediately by default', (event) => {
			renderHookWithTestProviders(() => useDirectoryChangeListener(event, callback));
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it.each(directoryChangeEvents)('should fire the %p callback immediately if runImmediate is true', (event) => {
			renderHookWithTestProviders(() => useDirectoryChangeListener(event, callback, true));
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it.each(directoryChangeEvents)(
			'should not fire the %p callback immediately if runImmediate is false',
			(event) => {
				renderHookWithTestProviders(() => useDirectoryChangeListener(event, callback, false));
				expect(callback).not.toHaveBeenCalled();
			});

		it.each(directoryChangeEvents)('should fire the callback only when a %p event is emitted', (listenerEvent) => {
			renderHookWithTestProviders(() => useDirectoryChangeListener(listenerEvent, callback, false));
			expect(callback).not.toHaveBeenCalled();

			let expectedCallCount = 0;
			for (const event of directoryChangeEvents) {
				act(() => directoryConnector.changeEventEmitter.fireEvent(event, true));
				if (event === listenerEvent) {
					expectedCallCount++;
				}
				expect(callback).toHaveBeenCalledTimes(expectedCallCount);
			}
		});
	});

	describe('useCurrentAccount', () => {
		it('should return the directory connector\'s current account information', () => {
			const { result, rerender } = renderHookWithTestProviders(useCurrentAccount);
			expect(result.current).toBe(directoryConnector.currentAccount.value);

			const newAccountInfo = MockAccountInfo({
				id: 999,
				username: 'useCurrentAccountTest',
				created: 1654862108851,
			});
			act(() => {
				directoryConnector.currentAccount.value = newAccountInfo;
			});
			rerender();
			expect(result.current).toBe(newAccountInfo);

			act(() => {
				directoryConnector.currentAccount.value = null;
			});
			rerender();
			expect(result.current).toBeNull();
		});
	});

	describe('useAuthToken', () => {
		it('should return the directory connector\'s current auth token information', () => {
			const { result, rerender } = renderHookWithTestProviders(useAuthToken);
			expect(result.current).toBe(directoryConnector.authToken.value);

			const newAuthToken = MockAuthToken({
				username: 'useAuthTokenTest',
				expires: 95617584000,
				value: 'eVA8tqM41UJMajBVXJAnOmmODXJIssEN',
			});
			act(() => {
				directoryConnector.authToken.value = newAuthToken;
			});
			rerender();
			expect(result.current).toBe(newAuthToken);

			act(() => {
				directoryConnector.authToken.value = undefined;
			});
			rerender();
			expect(result.current).toBeUndefined();
		});
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		const props = { directoryConnector, ...providerPropOverrides };
		return RenderHookWithProviders(hook, props);
	}
});
