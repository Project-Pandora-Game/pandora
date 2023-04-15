import { IShardDirectory, MessageHandler, IShardDirectoryPromiseResult, IShardDirectoryArgument, BadMessageError, IMessageHandler, AssertNotNullable } from 'pandora-common';
import type { IConnectionShard } from './common';
import { GetDatabase } from '../database/databaseProvider';
import { ShardManager } from '../shard/shardManager';
import promClient from 'prom-client';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';

const messagesMetric = new promClient.Counter({
	name: 'pandora_directory_shard_messages',
	help: 'Count of received messages from shards',
	labelNames: ['messageType'],
});

export const ConnectionManagerShard = new class ConnectionManagerShard implements IMessageHandler<IShardDirectory, IConnectionShard> {
	private readonly messageHandler: MessageHandler<IShardDirectory, IConnectionShard>;

	public async onMessage<K extends keyof IShardDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IShardDirectory>[K],
		context: IConnectionShard,
	): Promise<SocketInterfaceResponse<IShardDirectory>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
	}

	constructor() {
		this.messageHandler = new MessageHandler<IShardDirectory, IConnectionShard>({
			shardRegister: this.handleShardRegister.bind(this),
			shardRequestStop: this.handleShardRequestStop.bind(this),
			characterDisconnect: this.handleCharacterDisconnect.bind(this),
			roomUnload: this.handleRoomUnload.bind(this),
			createCharacter: this.createCharacter.bind(this),

			// Database
			getCharacter: this.handleGetCharacter.bind(this),
			setCharacter: this.handleSetCharacter.bind(this),
			getChatRoom: this.handleGetChatRoom.bind(this),
			setChatRoom: this.handleSetChatRoom.bind(this),
		});
	}

	public onDisconnect(connection: IConnectionShard): void {
		const shard = connection.shard;
		if (shard) {
			shard.setConnection(null);
		}
	}

	private async handleShardRegister(args: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (connection.shard)
			throw new BadMessageError();

		const shard = ShardManager.getOrCreateShard(connection.getTokenInfo());

		const result = await (shard.registered ? shard.handleReconnect(args, connection) : shard.register(args, connection));

		return result;
	}

	private handleShardRequestStop(_args: IShardDirectoryArgument['shardRequestStop'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRequestStop'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		return shard.stop();
	}

	private async handleCharacterDisconnect({ id /* TODO , reason */ }: IShardDirectoryArgument['characterDisconnect'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		await character.disconnect();
	}

	private async handleRoomUnload({ id /* TODO , reason */ }: IShardDirectoryArgument['roomUnload'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const room = shard.getConnectedRoom(id);
		if (!room)
			throw new BadMessageError();

		await room.disconnect();
	}

	private async createCharacter({ id }: IShardDirectoryArgument['createCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['createCharacter'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		const char = await character.finishCharacterCreation();
		if (!char)
			throw new BadMessageError();

		return char;
	}

	private async handleGetCharacter({ id, accessId }: IShardDirectoryArgument['getCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['getCharacter'] {
		if (!connection.shard?.getConnectedCharacter(id))
			throw new BadMessageError();

		return GetDatabase().getCharacter(id, accessId) as IShardDirectoryPromiseResult['getCharacter'];
	}

	private async handleSetCharacter(args: IShardDirectoryArgument['setCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['setCharacter'] {
		if (!connection.shard)
			throw new BadMessageError();

		if (Object.keys(args).length > 2 && !await GetDatabase().setCharacter(args))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}

	private async handleGetChatRoom({ id, accessId }: IShardDirectoryArgument['getChatRoom'], connection: IConnectionShard): IShardDirectoryPromiseResult['getChatRoom'] {
		if (!connection.shard?.getConnectedRoom(id))
			throw new BadMessageError();

		const result = await GetDatabase().getChatRoomById(id, accessId);
		AssertNotNullable(result);
		return result;
	}

	private async handleSetChatRoom({ id, data, accessId }: IShardDirectoryArgument['setChatRoom'], connection: IConnectionShard): IShardDirectoryPromiseResult['setChatRoom'] {
		if (!connection.shard)
			throw new BadMessageError();

		if (!await GetDatabase().updateChatRoom(id, data, accessId))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}
};
