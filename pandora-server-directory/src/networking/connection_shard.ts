import { GetLogger, IncomingSocket, IServerSocket, ShardDirectorySchema, IShardDirectory, IDirectoryShard, IncomingConnection, DirectoryShardSchema } from 'pandora-common';
import { ConnectionType, IConnectionShard } from './common';
import { ConnectionManagerShard } from './manager_shard';
import { Shard } from '../shard/shard';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';

/** Class housing connection from a shard */
export class ShardConnection extends IncomingConnection<IDirectoryShard, IShardDirectory, IncomingSocket> implements IConnectionShard {
	readonly type: ConnectionType.SHARD = ConnectionType.SHARD;

	public shard: Shard | null = null;

	constructor(server: IServerSocket<IDirectoryShard>, socket: IncomingSocket) {
		super(server, socket, [DirectoryShardSchema, ShardDirectorySchema], GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
		this.logger.verbose('Connected');
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerShard.onDisconnect(this);
	}

	protected onMessage<K extends keyof IShardDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IShardDirectory>[K],
		callback?: ((arg: SocketInterfaceResponse<IShardDirectory>[K]) => void) | undefined,
	): Promise<boolean> {
		return ConnectionManagerShard.onMessage(messageType, message, callback, this);
	}
}
