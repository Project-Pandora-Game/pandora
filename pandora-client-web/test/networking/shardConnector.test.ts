import { ShardConnectionState, ShardConnector } from '../../src/networking/shardConnector.ts';
import type { ClientServices } from '../../src/services/clientServices.ts';
import { MockConnectionInfo } from '../mocks/networking/mockShardConnector.ts';
import { MockServiceManager } from '../testUtils.tsx';

describe('ShardConnector', () => {
	const serviceManager = MockServiceManager();
	const mockShardConnector = new ShardConnector(
		MockConnectionInfo(),
		serviceManager.services as Readonly<ClientServices>,
	);

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
