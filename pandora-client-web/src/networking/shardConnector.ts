import type { IClientShard, IConnectionBase, IDirectoryCharacterConnectionInfo, IShardClientChangeEvents, TypedEventEmitter } from 'pandora-common';
import type { GameState } from '../components/gameContext/gameStateContextProvider';
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

export interface ShardConnector extends IConnectionBase<IClientShard> {
	/** Current state of the connection */
	readonly state: ReadonlyObservable<ShardConnectionState>;
	readonly gameState: ReadonlyObservable<GameState | null>;

	readonly connectionInfo: ReadonlyObservable<Readonly<IDirectoryCharacterConnectionInfo>>;

	/** Event emitter for shard change events */
	readonly changeEventEmitter: TypedEventEmitter<Record<IShardClientChangeEvents, true>>;

	connectionInfoMatches(info: IDirectoryCharacterConnectionInfo): boolean;

	connect(): Promise<this>;

	disconnect(): void;
}
