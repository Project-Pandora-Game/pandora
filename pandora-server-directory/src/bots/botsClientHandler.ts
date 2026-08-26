import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IClientDirectory, IClientDirectoryPromiseResult } from 'pandora-common/networking/api/directory_client';
import type { ClientConnection } from '../networking/connection_client.ts';
import { botManager } from './botManager.ts';

export const BotsClientHandler = {
	botDevelopmentListOwned: async (_args, connection): IClientDirectoryPromiseResult['botDevelopmentListOwned'] => {
		const account = connection.account;
		if (account == null)
			return { result: 'notLoggedIn' };

		const bots = await botManager.loadAllBotsOwnedBy(account.id);
		return {
			result: 'ok',
			bots: bots.map((it) => it.getPublicDefinition()),
		};
	},
	botDevelopmentCreate: async ({ config }, connection): IClientDirectoryPromiseResult['botDevelopmentCreate'] => {
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
	botDevelopmentUpdate: async ({ id, config }, connection): IClientDirectoryPromiseResult['botDevelopmentUpdate'] => {
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
	botDevelopmentDelete: async ({ id }, connection): IClientDirectoryPromiseResult['botDevelopmentDelete'] => {
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
