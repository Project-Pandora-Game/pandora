import { DirectoryShardSchema, GetLogger, IDirectoryShard, IncomingConnection, IncomingSocket, IServerSocket, IShardDirectory, ShardDirectorySchema } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers.js';
import { Shard } from '../shard/shard.ts';
import type { IConnectedTokenInfo } from '../shard/shardTokenStore.ts';
import { ConnectionType, IConnectionShard } from './common.ts';
import { ConnectionManagerShard } from './manager_shard.ts';

/** Class housing connection from a shard */
export class ShardConnection extends IncomingConnection<IDirectoryShard, IShardDirectory, IncomingSocket> implements IConnectionShard {
	public readonly type: ConnectionType.SHARD = ConnectionType.SHARD;
	private readonly info: IConnectedTokenInfo;

	public shard: Shard | null = null;

	public readonly connectionTime: number;

	constructor(server: IServerSocket<IDirectoryShard>, socket: IncomingSocket, info: IConnectedTokenInfo) {
		super(server, socket, [DirectoryShardSchema, ShardDirectorySchema], GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
		this.info = info;
		this.connectionTime = Date.now();
		this.logger.verbose(`Connected type: '${info.type}', token: ${info.id}`);

		if (!this.isConnected()) {
			this.logger.warning('Client disconnect before onConnect finished');
			queueMicrotask(() => {
				this.onDisconnect('isConnected check failed');
			});
		}
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerShard.onDisconnect(this);
		super.onDisconnect(reason);
	}

	protected onMessage<K extends keyof IShardDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IShardDirectory>[K],
	): Promise<SocketInterfaceResponse<IShardDirectory>[K]> {
		return ConnectionManagerShard.onMessage(messageType, message, this);
	}

	public getTokenInfo(): Readonly<IConnectedTokenInfo> {
		return this.info;
	}
}
