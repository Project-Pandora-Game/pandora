import type { IClientShardBase, IConnectionBase, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import type { PlayerCharacter } from '../character/player';
import type { ChatRoom } from '../components/gameContext/chatRoomContextProvider';
import type { ReadonlyObservable } from '../observable';

/** State of connection to Shard */
export enum ShardConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Shard for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection is waiting for shard to send initial data */
	WAIT_FOR_DATA,
	/** Connection to Shard is currently established */
	CONNECTED,
	/** Connection to Shard lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

export interface ShardConnector extends IConnectionBase<IClientShardBase, false> {
	/** Current state of the connection */
	readonly state: ReadonlyObservable<ShardConnectionState>;
	readonly player: ReadonlyObservable<PlayerCharacter | null>;
	readonly room: ChatRoom;

	readonly connectionInfo: ReadonlyObservable<Readonly<IDirectoryCharacterConnectionInfo>>;

	connectionInfoMatches(info: IDirectoryCharacterConnectionInfo): boolean;

	connect(): Promise<this>;

	disconnect(): void;
}
