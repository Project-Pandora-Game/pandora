import type { Socket } from 'socket.io';
import { GetLogger } from 'pandora-common';
import { ConnectionType } from './common';
import { SocketIOConnection } from './socketio_common_connection';
import ConnectionManagerShard from './manager_shard';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IDirectoryShard { } // TODO Implement this in panda-common

/** Class housing connection from a shard */
export class SocketIOConnectionShard extends SocketIOConnection<IDirectoryShard> {
	readonly type: ConnectionType = ConnectionType.SHARD;

	constructor(socket: Socket) {
		super(socket, GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
	}

	protected override onDisconnect(_reason: string): void {
		// TODO
	}

	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerShard.messageHandler.onMessage(messageType, message, callback, this);
	}
}
