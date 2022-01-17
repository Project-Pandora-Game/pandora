import { ConnectionType } from './common';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a shard */
export class SocketIOConnectionShard extends SocketIOConnection {
	readonly type: ConnectionType = ConnectionType.CLIENT;
}
