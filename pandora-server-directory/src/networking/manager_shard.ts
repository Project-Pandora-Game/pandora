import { BadMessageError, GetLogger, IMessageHandler, IShardDirectory, IShardDirectoryArgument, IShardDirectoryPromiseResult, MessageHandler, PANDORA_VERSION_DATABASE } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/networking/helpers';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider.ts';
import { ShardManager } from '../shard/shardManager.ts';
import type { IConnectionShard } from './common.ts';

const messagesMetric = new promClient.Counter({
	name: 'pandora_directory_shard_messages',
	help: 'Count of received messages from shards',
	labelNames: ['messageType'],
});

const logger = GetLogger('ConnectionManager-Shard');

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
			characterClientDisconnect: this.handleCharacterClientDisconnect.bind(this),
			characterAutomod: this.handleCharacterAutomod.bind(this),
			characterError: this.handleCharacterError.bind(this),
			spaceError: this.handleSpaceError.bind(this),
			spaceSwitchStatusUpdate: this.handleSpaceSwitchStatusUpdate.bind(this),
			createCharacter: this.createCharacter.bind(this),

			// Database
			getCharacter: this.handleGetCharacter.bind(this),
			setCharacter: this.handleSetCharacter.bind(this),
			getSpaceData: this.handleGetSpaceData.bind(this),
			setSpaceData: this.handleSetSpaceData.bind(this),
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

		if (args.databaseVersion !== PANDORA_VERSION_DATABASE) {
			logger.warning(`Shard '${connection.getTokenInfo().id}' attempted to register with unsupported database version (${args.databaseVersion} vs ${PANDORA_VERSION_DATABASE}), rejecting.`);
			// This responds "Rejected" without further warnings
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw false;
		}

		const shard = ShardManager.getOrCreateShard(connection.getTokenInfo());

		const result = await (shard.registered ? shard.handleReconnect(args, connection) : shard.register(args, connection));

		return result;
	}

	private async handleShardRequestStop(_args: IShardDirectoryArgument['shardRequestStop'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRequestStop'] {
		const shard = connection.shard;
		if (!shard) {
			await connection.awaitResponse('stop', {});
			return;
		}

		return shard.stop();
	}

	private async handleCharacterClientDisconnect({ id /* TODO , reason */ }: IShardDirectoryArgument['characterClientDisconnect'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		await shard.handleCharacterClientDisconnect(id);
	}

	private async handleCharacterAutomod({ id, action, reason }: IShardDirectoryArgument['characterAutomod'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		const space = character.space;
		if (space != null) {
			await space.automodAction(id, action, reason);
		}
	}

	private async handleCharacterError({ id }: IShardDirectoryArgument['characterError'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		await character.forceDisconnectShard();
	}

	private async handleSpaceError({ id }: IShardDirectoryArgument['spaceError'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const space = shard.getConnectedSpace(id);
		if (!space)
			throw new BadMessageError();

		await space.onError();
	}

	private async handleSpaceSwitchStatusUpdate({ id, status }: IShardDirectoryArgument['spaceSwitchStatusUpdate'], connection: IConnectionShard): Promise<void> {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();
		const space = shard.getConnectedSpace(id);
		if (!space) {
			await shard.update('spaces');
			throw new BadMessageError();
		}

		await space.spaceSwitchShardUpdate(status);
	}

	private async createCharacter({ id }: IShardDirectoryArgument['createCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['createCharacter'] {
		const shard = connection.shard;
		if (!shard)
			throw new BadMessageError();

		const character = shard.getConnectedCharacter(id);
		if (!character)
			throw new BadMessageError();

		const char = await character.baseInfo.finishCharacterCreation();
		if (!char)
			throw new BadMessageError();

		return char;
	}

	private async handleGetCharacter({ id, accessId }: IShardDirectoryArgument['getCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['getCharacter'] {
		if (!connection.shard?.getConnectedCharacter(id))
			throw new BadMessageError();

		return {
			result: await GetDatabase().getCharacter(id, accessId),
		};
	}

	private async handleSetCharacter({ id, data, accessId }: IShardDirectoryArgument['setCharacter'], connection: IConnectionShard): IShardDirectoryPromiseResult['setCharacter'] {
		if (!connection.shard)
			throw new BadMessageError();

		if (!await GetDatabase().updateCharacter(id, data, accessId))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}

	private async handleGetSpaceData({ id, accessId }: IShardDirectoryArgument['getSpaceData'], connection: IConnectionShard): IShardDirectoryPromiseResult['getSpaceData'] {
		if (!connection.shard?.getConnectedSpace(id))
			throw new BadMessageError();

		return {
			result: await GetDatabase().getSpaceById(id, accessId),
		};
	}

	private async handleSetSpaceData({ id, data, accessId }: IShardDirectoryArgument['setSpaceData'], connection: IConnectionShard): IShardDirectoryPromiseResult['setSpaceData'] {
		if (!connection.shard)
			throw new BadMessageError();

		if (!await GetDatabase().updateSpace(id, data, accessId))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}
};
