import type { IConnectionBase, IShardClientBase } from 'pandora-common';

export enum ConnectionType {
	CLIENT,
}

export interface IConnectionClient extends IConnectionBase<IShardClientBase> {
	readonly type: ConnectionType.CLIENT;
	/** ID of the client, primarily used for logging */
	readonly id: string;

	isConnected(): boolean;
}
