import { IShardDirectory, MessageHandler, IShardDirectoryPromiseResult, IShardDirectoryArgument, BadMessageError, IMessageHandler } from 'pandora-common';
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
		callback: ((arg: SocketInterfaceResponse<IShardDirectory>[K]) => void) | undefined,
		context: IConnectionShard,
	): Promise<boolean> {
		return this.messageHandler.onMessage(messageType, message, callback, context).then((result) => {
			// Only count valid messages
			if (result) {
				messagesMetric.inc({ messageType });
			}
			return result;
		});
	}

	constructor() {
		this.messageHandler = new MessageHandler<IShardDirectory, IConnectionShard>({
			getCharacter: this.handleGetCharacter.bind(this),
			setCharacter: this.handleSetCharacter.bind(this),
			shardRegister: this.handleShardRegister.bind(this),
			createCharacter: this.createCharacter.bind(this),
		}, {
			characterDisconnect: this.handleCharacterDisconnect.bind(this),
			shardRequestStop: this.handleShardRequestStop.bind(this),
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

		const shard = ShardManager.getOrCreateShard(args.shardId);

		const result = shard.registered ? shard.handleReconnect(args, connection) : await shard.register(args, connection);

		return result;
	}

	private handleShardRequestStop(_args: IShardDirectoryArgument['shardRequestStop'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRequestStop'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		return shard.stop();
	}

	private handleCharacterDisconnect({ id /* TODO , reason */ }: IShardDirectoryArgument['characterDisconnect'], connection: IConnectionShard): void {
		const shard = connection.shard;
		if (!shard || !shard?.getConnectedCharacter(id))
			throw new BadMessageError();

		shard.disconnectCharacter(id);
	}

	private async createCharacter({ id }: IShardDirectoryArgument['createCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['createCharacter'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		const char = await character.account.finishCharacterCreation(id);
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
};
