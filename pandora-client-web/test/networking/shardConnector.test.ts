import { Assert } from 'pandora-common';
import { ShardConnectionState, ShardConnector } from '../../src/networking/shardConnector';
import { MockConnectionInfo } from '../mocks/networking/mockShardConnector';
import { MockServiceManager } from '../testUtils';

describe('ShardConnector', () => {
	const serviceManager = MockServiceManager();
	Assert(serviceManager.services.directoryConnector != null);
	Assert(serviceManager.services.accountManager != null);
	const mockShardConnector = new ShardConnector(MockConnectionInfo(), serviceManager.services.directoryConnector, serviceManager.services.accountManager);

	it('default state should be NONE', () => {
		expect(mockShardConnector.state.value).toBe(ShardConnectionState.NONE);
	});

	it('should have constructor passed connection info', () => {
		expect(mockShardConnector.connectionInfo.value).toStrictEqual(MockConnectionInfo());
	});

	describe('connectionInfoMatches()', () => {
		it('should return true on matching connection info', () => {
			expect(mockShardConnector.connectionInfoMatches(MockConnectionInfo()))
				.toBe(true);
		});

		it('should return false on different connection info', () => {
			expect(mockShardConnector.connectionInfoMatches(MockConnectionInfo({ characterId: 'c94359873489' })))
				.toBe(false);
		});
	});

	describe('connect()', () => {
		it.todo('should connect');
	});

	describe('disconnect()', () => {
		it('should set state to DISCONNECTED', () => {
			mockShardConnector.disconnect();
			expect(mockShardConnector.state.value).toBe(ShardConnectionState.DISCONNECTED);
		});
	});
});
