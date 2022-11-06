import type { IncomingHttpHeaders } from 'http';
import type { IShardClient, CharacterId, IIncomingConnection } from 'pandora-common';
import type { Character } from '../character/character';

export enum ConnectionType {
	CLIENT,
}

export interface IConnectionClient extends IIncomingConnection<IShardClient> {
	readonly type: ConnectionType.CLIENT;
	/** ID of the client, primarily used for logging */
	readonly id: string;
	/** The associated character */
	character: Character | null;
	readonly aborted: boolean;
	readonly headers: IncomingHttpHeaders;

	isConnected(): boolean;

	abortConnection(): void;

	loadCharacter(id: CharacterId): boolean;
}
