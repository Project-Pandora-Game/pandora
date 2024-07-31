import { IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { GameState } from '../../../src/components/gameContext/gameStateContextProvider';
import type { DirectoryConnector } from '../../../src/networking/directoryConnector';
import { ShardConnectionState, ShardConnector } from '../../../src/networking/shardConnector';
import { ShardChangeEventEmitter } from '../../../src/networking/socketio_shard_connector';
import { Observable } from '../../../src/observable';

/** Mock shard connector implementation for testing */
export class MockShardConnector implements ShardConnector {
	public readonly connectionInfo: Observable<Readonly<IDirectoryCharacterConnectionInfo>>;
	public readonly state = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	public readonly gameState: Observable<GameState | null>;
	public readonly directoryConnector: DirectoryConnector;
	public readonly changeEventEmitter = new ShardChangeEventEmitter();

	constructor(directoryConnector: DirectoryConnector, info: IDirectoryCharacterConnectionInfo = MockConnectionInfo(), gameState: Observable<GameState | null> = new Observable<GameState | null>(null)) {
		this.directoryConnector = directoryConnector;
		this.connectionInfo = new Observable<Readonly<IDirectoryCharacterConnectionInfo>>(info);
		this.gameState = gameState;
	}

	public awaitResponse = jest.fn().mockResolvedValue(undefined);

	public connect = jest.fn().mockResolvedValue(undefined);

	public connectionInfoMatches = jest.fn().mockReturnValue(false);

	public disconnect = jest.fn();

	public sendMessage = jest.fn();
}

export function MockConnectionInfo(overrides?: Partial<IDirectoryCharacterConnectionInfo>): IDirectoryCharacterConnectionInfo {
	return {
		id: '5099803df3f4948bd2f98391',
		publicURL: 'http://shard-url:12345',
		features: [],
		version: '0.0.0',
		characterId: 'c123',
		secret: 'uXFqcVOH',
		...overrides,
	};
}
