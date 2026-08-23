import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IClientDirectory, IClientDirectoryPromiseResult } from 'pandora-common/networking/api/directory_client';
import type { ClientConnection } from '../networking/connection_client.ts';
import { botManager } from './botManager.ts';

export const BotsClientHandler = {
	listOwnedBots: async (_args, connection): IClientDirectoryPromiseResult['listOwnedBots'] => {
		const account = connection.account;
		if (account == null)
			return { result: 'notLoggedIn' };

		const bots = await botManager.loadAllBotsOwnedBy(account.id);
		return {
			result: 'ok',
			bots: bots.map((it) => it.getPublicDefinition()),
		};
	},
	createBot: async ({ config }, connection): IClientDirectoryPromiseResult['createBot'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const result = await botManager.createBot(config, account);

		if (typeof result === 'string')
			return { result };

		return {
			result: 'ok',
			id: result.id,
		};
	},
	updateBot: async ({ id, config }, connection): IClientDirectoryPromiseResult['updateBot'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const bot = await botManager.loadBotById(id);
		if (bot == null || bot.ownerAccount !== account.id)
			return { result: 'notFound' };

		const result = await bot.updateConfig(config);

		return {
			result,
		};
	},
	deleteBot: async ({ id }, connection): IClientDirectoryPromiseResult['deleteBot'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const bot = await botManager.loadBotById(id);
		if (bot == null || bot.ownerAccount !== account.id)
			return { result: 'notFound' };

		await bot.delete();

		return {
			result: 'ok',
		};
	},
} satisfies Partial<MessageHandlers<IClientDirectory, ClientConnection>>;
