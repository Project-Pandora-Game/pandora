import { GetLogger, IncomingSocket, IServerSocket, ShardDirectorySchema, IShardDirectory, IDirectoryShard, IncomingConnection, DirectoryShardSchema } from 'pandora-common';
import { ConnectionType, IConnectionShard } from './common';
import { ConnectionManagerShard } from './manager_shard';
import { Shard } from '../shard/shard';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import type { ConnectedTokenInfo, IConnectedTokenInfo } from '../shard/shardTokenStore';

/** Class housing connection from a shard */
export class ShardConnection extends IncomingConnection<IDirectoryShard, IShardDirectory, IncomingSocket> implements IConnectionShard {
	public readonly type: ConnectionType.SHARD = ConnectionType.SHARD;
	private readonly info: ConnectedTokenInfo;

	public shard: Shard | null = null;

	constructor(server: IServerSocket<IDirectoryShard>, socket: IncomingSocket, info: ConnectedTokenInfo) {
		super(server, socket, [DirectoryShardSchema, ShardDirectorySchema], GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
		this.info = info;
		this.logger.verbose('Connected');
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		this.info.remove();
		ConnectionManagerShard.onDisconnect(this);
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
