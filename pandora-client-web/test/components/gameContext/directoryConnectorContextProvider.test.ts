import { RenderHookResult } from '@testing-library/react';
import { IDirectoryClientChangeEvents } from 'pandora-common';
import {
	useAuthToken,
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../src/components/gameContext/directoryConnectorContextProvider';
import { DirectoryConnector } from '../../../src/networking/directoryConnector';
import { ProvidersProps, RenderHookWithProviders } from '../../testUtils';

const directoryChangeEvents: IDirectoryClientChangeEvents[] = [
	'characterList',
	'shardList',
	'spaceList',
];

describe('DirectoryConnectorContextProvider', () => {
	let directoryConnector: DirectoryConnector;

	beforeEach(() => {
		directoryConnector = new DirectoryConnector();
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
	});

	describe('useCurrentAccount', () => {
		it('should return the directory connector\'s current account information', () => {
			const { result } = renderHookWithTestProviders(useCurrentAccount);
			expect(result.current).toBe(directoryConnector.currentAccount.value);
		});
	});

	describe('useAuthToken', () => {
		it('should return the directory connector\'s current auth token information', () => {
			const { result } = renderHookWithTestProviders(useAuthToken);
			expect(result.current).toBe(directoryConnector.authToken.value);
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
