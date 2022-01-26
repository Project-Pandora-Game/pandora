import { IShardDirectoryMessageHandler, IShardDirectoryBase, MessageHandler } from 'pandora-common';
import { SocketIOConnectionShard } from './socketio_shard_connection';

export default new class ConnectionManagerShard {
	readonly messageHandler: IShardDirectoryMessageHandler<SocketIOConnectionShard>;

	constructor() {
		this.messageHandler = new MessageHandler<IShardDirectoryBase>({}, {});
	}
};
