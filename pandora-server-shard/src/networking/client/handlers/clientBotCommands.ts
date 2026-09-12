import {
	BadMessageError,
	DEFAULT_ACK_TIMEOUT,
	GetLogger,
	type MessageHandlers,
} from 'pandora-common';
import type { IClientShard, IClientShardPromiseResult } from 'pandora-common/networking/api/shard_client';
import type { ClientConnection } from '../../connection_client.ts';

/** Client message handlers related to custom bot commands. */
export const ClientHandlersBotCommands = {
	botCommandsGet: async (_args, connection): IClientShardPromiseResult['botCommandsGet'] => {
		if (!connection.character)
			throw new BadMessageError();

		const character = connection.character;
		const space = character.loadedSpace;
		const bot = space?.bot;
		if (space == null || bot == null)
			return { result: 'noBot' };

		const botConnection = bot.connection;
		if (botConnection == null)
			return { result: 'botDisconnected' };

		try {
			const result = await botConnection.awaitResponse('getCharacterCommands', {
				id: character.id,
			}, DEFAULT_ACK_TIMEOUT / 2); // Limit timeout so we can answer with failure instead of client itself timing out

			return {
				result: 'ok',
				commands: result.commands,
			};
		} catch (err) {
			GetLogger('BotHandlersChat')
				.verbose(`Error while querying bot ${bot.id}|${space.id} during botCommandsGet from ${character.id}:`, err);
			return { result: 'botError' };
		}
	},
	botCommandRun: async ({ command, args }, connection): IClientShardPromiseResult['botCommandRun'] => {
		if (!connection.character)
			throw new BadMessageError();

		const character = connection.character;
		const space = character.loadedSpace;
		const bot = space?.bot;
		if (space == null || bot == null)
			return { result: 'noBot' };

		const botConnection = bot.connection;
		if (botConnection == null)
			return { result: 'botDisconnected' };

		try {
			const result = await botConnection.awaitResponse('runCharacterCommand', {
				id: character.id,
				command,
				args,
			}, DEFAULT_ACK_TIMEOUT / 2); // Limit timeout so we can answer with failure instead of client itself timing out

			return result;
		} catch (err) {
			GetLogger('BotHandlersChat')
				.verbose(`Error while querying bot ${bot.id}|${space.id} during botCommandsGet from ${character.id}:`, err);
			return { result: 'botError' };
		}
	},
	botCommandGetStructurePart: async ({ command, args }, connection): IClientShardPromiseResult['botCommandGetStructurePart'] => {
		if (!connection.character)
			throw new BadMessageError();

		const character = connection.character;
		const space = character.loadedSpace;
		const bot = space?.bot;
		if (space == null || bot == null)
			return { result: 'noBot' };

		const botConnection = bot.connection;
		if (botConnection == null)
			return { result: 'botDisconnected' };

		try {
			const result = await botConnection.awaitResponse('getCharacterCommandStructurePart', {
				id: character.id,
				command,
				args,
			}, DEFAULT_ACK_TIMEOUT / 2); // Limit timeout so we can answer with failure instead of client itself timing out

			return result;
		} catch (err) {
			GetLogger('BotHandlersChat')
				.verbose(`Error while querying bot ${bot.id}|${space.id} during botCommandsGet from ${character.id}:`, err);
			return { result: 'botError' };
		}
	},
} satisfies Partial<MessageHandlers<IClientShard, ClientConnection>>;
