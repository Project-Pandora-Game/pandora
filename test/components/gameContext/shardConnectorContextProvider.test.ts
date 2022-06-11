import { act, renderHook, RenderHookResult } from '@testing-library/react';
import { IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { useContext } from 'react';
import {
	shardConnectorContext,
	ShardConnectorContextData,
	useConnectToShard,
	useShardConnectionInfo,
	useShardConnector,
} from '../../../src/components/gameContext/shardConnectorContextProvider';
import { MockDirectoryConnector } from '../../mocks/networking/mockDirectoryConnector';
import { MockConnectionInfo, MockShardConnector } from '../../mocks/networking/mockShardConnector';
import { ProvidersProps, RenderHookWithProviders } from '../../testUtils';

describe('ShardConnectorContextProvider', () => {
	let directoryConnector: MockDirectoryConnector;
	let shardConnector: MockShardConnector;
	const setShardConnector = jest.fn();

	beforeEach(() => {
		directoryConnector = new MockDirectoryConnector();
		shardConnector = new MockShardConnector();
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
			const { result, rerender } = renderHookWithTestProviders(useShardConnectionInfo);
			expect(result.current).toBe(shardConnector.connectionInfo.value);

			const newConnectionInfo = MockConnectionInfo({
				characterId: 'c9999',
				secret: 'm2bQ67Ls',
			});
			act(() => {
				shardConnector.connectionInfo.value = newConnectionInfo;
			});

			rerender();
			expect(result.current).toBe(newConnectionInfo);
		});
	});

	describe('useConnectToShard', () => {
		describe('connecting to a different shard', () => {
			beforeEach(() => {
				shardConnector.connectionInfoMatches.mockReturnValue(false);
			});

			it('should disconnect from the current shard if currently connected', async () => {
				expect(shardConnector.disconnect).not.toHaveBeenCalled();
				await renderAndRunHook();
				expect(shardConnector.disconnect).toHaveBeenCalledTimes(1);
			});

			it('should instantiate and set a new shard connector with the new connection info', async () => {
				expect(setShardConnector).not.toHaveBeenCalled();
				const newConnectionInfo = MockConnectionInfo({
					id: '62a28ca0fda2c528e924f43c',
					publicURL: 'http://another-shard:8080',
					version: '1.0.0',
					characterId: 'c999',
					secret: 'me-0ITg3',
				});
				await renderAndRunHook(newConnectionInfo);
				expect(setShardConnector).toHaveBeenCalled();
				expect(setShardConnector).toHaveBeenLastCalledWith(expect.any(MockShardConnector));
				expect(setShardConnector).not.toHaveBeenLastCalledWith(shardConnector);
				const newShardConnector = (setShardConnector.mock.lastCall as [MockShardConnector])[0];
				expect(newShardConnector.connectionInfo.value).toBe(newConnectionInfo);
				expect(newShardConnector.connect).toHaveBeenCalledTimes(1);
			});

			it('should set the new connection info on the directory connector', async () => {
				expect(directoryConnector.setShardConnectionInfo).not.toHaveBeenCalled();
				const newConnectionInfo = MockConnectionInfo({
					id: '62a28e16fda2c528e924f43d',
					publicURL: 'http://shard-42:9999',
					version: '4.2.0',
					characterId: 'c420',
					secret: 'ut9NscdL',
				});
				await renderAndRunHook(newConnectionInfo);
				expect(directoryConnector.setShardConnectionInfo).toHaveBeenCalledTimes(1);
				expect(directoryConnector.setShardConnectionInfo).toHaveBeenLastCalledWith(newConnectionInfo);
			});
		});

		describe('connecting to the same shard', () => {
			beforeEach(() => {
				shardConnector.connectionInfoMatches.mockReturnValue(true);
			});

			it('should not disconnect from the current shard if currently connected', async () => {
				await renderAndRunHook();
				expect(shardConnector.disconnect).not.toHaveBeenCalled();
			});

			it('should not set a new shard connector', async () => {
				await renderAndRunHook();
				expect(setShardConnector).not.toHaveBeenCalled();
			});

			it('should not set any new connection info on the directory connector', async () => {
				await renderAndRunHook();
				expect(directoryConnector.setShardConnectionInfo).not.toHaveBeenCalled();
			});
		});

		function renderAndRunHook(info: IDirectoryCharacterConnectionInfo = MockConnectionInfo()): Promise<void> {
			const { result: { current } } = renderHookWithTestProviders(useConnectToShard);
			return current(info);
		}
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		const props = { directoryConnector, shardConnector, setShardConnector, ...providerPropOverrides };
		return RenderHookWithProviders(hook, props);
	}
});
