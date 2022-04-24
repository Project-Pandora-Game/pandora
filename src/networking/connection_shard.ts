import { Connection, GetLogger, IDirectoryShardBase, IncomingSocket } from 'pandora-common';
import { ConnectionType, IConnectionShard } from './common';
import { ConnectionManagerShard } from './manager_shard';
import { Shard } from '../shard/shard';

/** Class housing connection from a shard */
export class ShardConnection extends Connection<IncomingSocket, IDirectoryShardBase, true> implements IConnectionShard {
	readonly type: ConnectionType.SHARD = ConnectionType.SHARD;

	public shard: Shard | null = null;

	constructor(socket: IncomingSocket) {
		super(socket, GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
		this.logger.verbose('Connected');
	}

	protected override onDisconnect(reason: string): void {
		this.logger.verbose('Disconnected, reason:', reason);
		ConnectionManagerShard.onDisconnect(this);
	}

	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerShard.messageHandler.onMessage(messageType, message, callback, this);
	}
}
