export enum ConnectionType {
	SHARD,
	CLIENT,
}

export interface IConnection {
	readonly type: ConnectionType;
	isConnected(): boolean;
}
