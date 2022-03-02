import type { IncomingHttpHeaders } from 'http';
import type { IConnectionBase, IShardClientBase, CharacterId } from 'pandora-common';
import type Character from '../character/character';

export enum ConnectionType {
	CLIENT,
}

export interface IConnectionClient extends IConnectionBase<IShardClientBase> {
	readonly type: ConnectionType.CLIENT;
	/** ID of the client, primarily used for logging */
	readonly id: string;
	readonly character: Character;
	readonly aborted: boolean;
	readonly headers: IncomingHttpHeaders;

	isConnected(): boolean;

	abortConnection(): void;

	loadCharacter(id: CharacterId): boolean;
}
