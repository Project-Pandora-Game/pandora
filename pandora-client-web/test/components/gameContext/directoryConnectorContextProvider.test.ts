import { RenderHookResult } from '@testing-library/react';
import { Assert, IDirectoryClientChangeEvents, type ServiceManager } from 'pandora-common';
import {
	useAuthToken,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../src/components/gameContext/directoryConnectorContextProvider.tsx';
import { DirectoryConnector } from '../../../src/networking/directoryConnector.ts';
import type { ClientServices } from '../../../src/services/clientServices.ts';
import { MockServiceManager, ProvidersProps, RenderHookWithProviders } from '../../testUtils.tsx';
const jest = import.meta.jest; // Jest is not properly injected in ESM

const directoryChangeEvents: IDirectoryClientChangeEvents[] = [
	'characterList',
	'shardList',
	'spaceList',
];

describe('DirectoryConnectorContextProvider', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let directoryConnector: DirectoryConnector;

	beforeEach(() => {
		serviceManager = MockServiceManager();
		Assert(serviceManager.services.directoryConnector != null);
		directoryConnector = serviceManager.services.directoryConnector;
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
		return RenderHookWithProviders(hook, { serviceManager, ...providerPropOverrides });
	}
});
