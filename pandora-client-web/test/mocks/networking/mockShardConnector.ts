import { IDirectoryCharacterConnectionInfo } from 'pandora-common';
import { PlayerCharacter } from '../../../src/character/player';
import { ShardConnectionState, ShardConnector } from '../../../src/networking/shardConnector';
import { Observable } from '../../../src/observable';

/** Mock shard connector implementation for testing */
export class MockShardConnector implements ShardConnector {
	public readonly connectionInfo: Observable<Readonly<IDirectoryCharacterConnectionInfo>>;
	public readonly state = new Observable<ShardConnectionState>(ShardConnectionState.NONE);
	public readonly player: Observable<PlayerCharacter | null>;

	public constructor(info: IDirectoryCharacterConnectionInfo = MockConnectionInfo(), player: Observable<PlayerCharacter | null> = new Observable<PlayerCharacter | null>(null)) {
		this.connectionInfo = new Observable<Readonly<IDirectoryCharacterConnectionInfo>>(info);
		this.player = player;
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
