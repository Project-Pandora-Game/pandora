import { IShardDirectoryMessageHandler, IShardDirectoryBase, MessageHandler, IShardDirectoryPromiseResult, IShardDirectoryUnconfirmedArgument, IShardDirectoryNormalResult, IsString, IsCharacterId, BadMessageError, Shard as Validation } from 'pandora-common';
import type { IConnectionShard } from './common';
import { GetDatabase } from '../database/databaseProvider';
import { ShardManager } from '../shard/shardManager';
import promClient from 'prom-client';

const messagesMetric = new promClient.Counter({
	name: 'pandora_directory_shard_messages',
	help: 'Count of received messages from shards',
	labelNames: ['messageType'],
});

export const ConnectionManagerShard = new class ConnectionManagerShard {
	private readonly messageHandler: IShardDirectoryMessageHandler<IConnectionShard>;

	public onMessage(messageType: string, message: Record<string, unknown>, callback: ((arg: Record<string, unknown>) => void) | undefined, connection: IConnectionShard): Promise<boolean> {
		return this.messageHandler.onMessage(messageType, message, callback, connection).then((result) => {
			// Only count valid messages
			if (result) {
				messagesMetric.inc({ messageType });
			}
			return result;
		});
	}

	constructor() {
		this.messageHandler = new MessageHandler<IShardDirectoryBase, IConnectionShard>({
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

	private async handleShardRegister(args: IShardDirectoryUnconfirmedArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (!Validation.shardRegister(args) || connection.shard)
			throw new BadMessageError();

		const shard = ShardManager.getOrCreateShard(args.shardId);

		const result = shard.registered ? shard.handleReconnect(args, connection) : await shard.register(args, connection);

		return result;
	}

	private handleShardRequestStop(_args: IShardDirectoryUnconfirmedArgument['shardRequestStop'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRequestStop'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		return shard.stop();
	}

	private handleCharacterDisconnect({ id, reason }: IShardDirectoryUnconfirmedArgument['characterDisconnect'], connection: IConnectionShard): void {
		const shard = connection.shard;
		if (!IsCharacterId(id) || !shard || !shard.getConnectedCharacter(id) || !IsString(reason))
			throw new BadMessageError();

		shard.disconnectCharacter(id);
	}

	private async createCharacter({ id }: IShardDirectoryUnconfirmedArgument['createCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['createCharacter'] {
		const shard = connection.shard;
		if (!IsCharacterId(id) || !shard)
			throw new BadMessageError();

		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		const char = await character.account.finishCharacterCreation(id);
		if (!char)
			throw new BadMessageError();

		return char;
	}

	private async handleGetCharacter({ id, accessId }: IShardDirectoryUnconfirmedArgument['getCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['getCharacter'] {
		const shard = connection.shard;
		if (!IsCharacterId(id) || !IsString(accessId) || !shard || !shard.getConnectedCharacter(id))
			throw new BadMessageError();

		return await GetDatabase().getCharacter(id, accessId) as IShardDirectoryNormalResult['getCharacter'];
	}

	private async handleSetCharacter(args: IShardDirectoryUnconfirmedArgument['setCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['setCharacter'] {
		const shard = connection.shard;
		if (!Validation.setCharacter(args) || !CheckSetCharacterKeys(args) || !shard || !shard.getConnectedCharacter(args.id))
			throw new BadMessageError();

		if (Object.keys(args).length > 2 && !await GetDatabase().setCharacter(args))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}
};

const CheckSetCharacterKeys = (obj: Record<string, unknown>) => !['inCreation', 'accountId', 'created'].some((key) => key in obj);
