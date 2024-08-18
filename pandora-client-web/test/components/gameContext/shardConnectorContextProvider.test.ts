import { renderHook, RenderHookResult } from '@testing-library/react';
import { useContext } from 'react';
import {
	shardConnectorContext,
	ShardConnectorContextData,
	useShardConnectionInfo,
	useShardConnector,
} from '../../../src/components/gameContext/shardConnectorContextProvider';
import { DirectoryConnector } from '../../../src/networking/directoryConnector';
import { ShardConnector } from '../../../src/networking/shardConnector';
import { MockConnectionInfo } from '../../mocks/networking/mockShardConnector';
import { MockServiceManager, ProvidersProps, RenderHookWithProviders } from '../../testUtils';
import { Assert, type ServiceManager } from 'pandora-common';

describe('ShardConnectorContextProvider', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let directoryConnector: DirectoryConnector;
	let shardConnector: ShardConnector;
	const setShardConnector = jest.fn();

	beforeEach(() => {
		serviceManager = MockServiceManager();
		Assert(serviceManager.services.directoryConnector != null);
		directoryConnector = serviceManager.services.directoryConnector;
		shardConnector = new ShardConnector(MockConnectionInfo(), directoryConnector);
	});

	describe('shardConnectorContext', () => {
		let contextData: ShardConnectorContextData;

		beforeEach(() => {
			contextData = renderHook(() => useContext(shardConnectorContext)).result.current;
		});

		it('should return a null shard connector outside of a context provider', () => {
			expect(contextData.shardConnector).toBeNull();
		});

		it('should throw an error if trying to set a shard connector outside of a context provider', () => {
			expect(() => contextData.setShardConnector(shardConnector))
				.toThrow('setShardConnector called outside of the ShardConnectorContextProvider');
		});
	});

	describe('useShardConnector', () => {
		it('should return the current shard connector', () => {
			const { result: { current } } = renderHookWithTestProviders(useShardConnector);
			expect(current).toBe(shardConnector);
		});
	});

	describe('useShardConnectionInfo', () => {
		it('should return null if there is no current shard connector', () => {
			const { result } = renderHookWithTestProviders(useShardConnectionInfo, { shardConnector: null });
			expect(result.current).toBeNull();
		});

		it('should return the shard connector\'s current connection info', () => {
			const { result } = renderHookWithTestProviders(useShardConnectionInfo);
			expect(result.current).toBe(shardConnector.connectionInfo.value);
		});
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		const props = { serviceManager, directoryConnector, shardConnector, setShardConnector, ...providerPropOverrides };
		return RenderHookWithProviders(hook, props);
	}
});
