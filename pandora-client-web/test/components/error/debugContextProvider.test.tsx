import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { DebugContextProvider, useDebugContext } from '../../../src/components/error/debugContextProvider.tsx';
import { DirectoryConnectionState } from '../../../src/networking/directoryConnector.ts';
import { ShardConnectionState } from '../../../src/networking/shardConnector.ts';
import { MockDebugData } from '../../mocks/error/errorMocks.ts';
import { MockConnectionInfo } from '../../mocks/networking/mockShardConnector.ts';

describe('DebugContextProvider', () => {
	it('should initially provide an empty debug data object', () => {
		const { result } = renderHook(useDebugContext, { wrapper: DebugContextProvider });
		expect(result.current.debugData).toStrictEqual({});
	});

	it('should allow data to be set', () => {
		const { result, rerender } = renderHook(useDebugContext, { wrapper: DebugContextProvider });
		const debugData = MockDebugData({
			shardConnectionInfo: {
				id: '5099803df3f4948bd2f98391',
				publicURL: 'http://shard-url:12345',
				features: [],
				version: '0.0.0',
			},
		});
		act(() => result.current.setDebugData(debugData));
		rerender();
		expect(result.current.debugData).toStrictEqual(debugData);
	});

	it('should permit partial updates', () => {
		const { result, rerender } = renderHook(useDebugContext, { wrapper: DebugContextProvider });

		act(() => result.current.setDebugData({ directoryState: DirectoryConnectionState.CONNECTION_LOST }));
		rerender();
		expect(result.current.debugData).toStrictEqual({ directoryState: DirectoryConnectionState.CONNECTION_LOST });

		act(() => result.current.setDebugData({ shardState: ShardConnectionState.INITIAL_CONNECTION_PENDING }));
		rerender();
		expect(result.current.debugData).toStrictEqual({
			directoryState: DirectoryConnectionState.CONNECTION_LOST,
			shardState: ShardConnectionState.INITIAL_CONNECTION_PENDING,
		});

		act(() => result.current.setDebugData({ directoryState: DirectoryConnectionState.CONNECTED }));
		rerender();
		expect(result.current.debugData).toStrictEqual({
			directoryState: DirectoryConnectionState.CONNECTED,
			shardState: ShardConnectionState.INITIAL_CONNECTION_PENDING,
		});
	});

	it('should strip out sensitive connection information', () => {
		const { result, rerender } = renderHook(useDebugContext, { wrapper: DebugContextProvider });
		const connectionInfo = MockConnectionInfo();
		act(() => result.current.setDebugData({
			shardConnectionInfo: connectionInfo,
		}));
		rerender();
		expect(result.current.debugData.shardConnectionInfo).toStrictEqual({
			id: connectionInfo.id,
			publicURL: connectionInfo.publicURL,
			features: connectionInfo.features,
			version: connectionInfo.version,
		});
	});
});
