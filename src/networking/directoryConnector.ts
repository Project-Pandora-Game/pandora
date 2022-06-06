import {
	CharacterId,
	IClientDirectoryBase,
	IConnectionBase,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
} from 'pandora-common';
import { TypedEventEmitter } from '../event';
import { ReadonlyObservable } from '../observable';

/** State of connection to Directory */
export enum DirectoryConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Directory for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection to Directory is currently established */
	CONNECTED,
	/** Connection to Directory lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

export interface IDirectoryConnector extends IConnectionBase<IClientDirectoryBase, false> {
	/** Current state of the connection */
	readonly state: ReadonlyObservable<DirectoryConnectionState>;

	/** Directory status data */
	readonly directoryStatus: ReadonlyObservable<IDirectoryStatus>;

	/** Event emitter for directory change events */
	readonly changeEventEmitter: TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>>;

	connect(): Promise<this>;

	disconnect(): void;

	createNewCharacter(): Promise<boolean>;

	connectToCharacter(id: CharacterId): Promise<boolean>;

	setActiveShardId(id?: string): void;
}
