import type { PlayerCharacter } from '../../../src/character/player';
import { ParseCommands } from '../../../src/components/chatroom/commands';
import { SocketIOShardConnector } from '../../../src/networking/socketio_shard_connector';
import { Observable } from '../../../src/observable';
import { ChatRoomHandlerMock } from '../../gameContext/chatRoomContectProvider';
import { MockConnectionInfo } from '../../mocks/networking/mockShardConnector';

describe('ParseCommands()', () => {
	const mockShardConnector = new SocketIOShardConnector(MockConnectionInfo(), new Observable<PlayerCharacter | null>(null), new ChatRoomHandlerMock());
	it('should return the text if is not a command', () => {
		expect(ParseCommands(mockShardConnector, 'meh')).toBe('meh');
	});

	it('should treat concat command key as escape', () => {
		expect(ParseCommands(mockShardConnector, '////how is this for yah')).toBe('///how is this for yah');
	});

	it.skip('should ', () => {
		expect(ParseCommands(mockShardConnector, '/say hi')).toBe(true); // ??
	});
});
