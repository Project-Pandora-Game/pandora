import { ConnectionType } from './common';
import { SocketIOConnection } from './socketio_common_connection';

/** Class housing connection from a client */
export class SocketIOConnectionClient extends SocketIOConnection {
	readonly type: ConnectionType = ConnectionType.CLIENT;
}
