import {
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryNormalResult, IApiDirectoryPromiseResult } from 'pandora-common/networking/api/directory_api';
import type { ApiConnection } from '../networking/api/socket/connection_api.ts';
import { botManager } from './botManager.ts';

export const ApiHandlersBots = {
	botRunRegister: async ({ bot }, connection): IApiDirectoryPromiseResult['botRunRegister'] => {
		const account = connection.verifyTokenUseAndGetAccount(['bots:run']);
		if (account == null)
			return { result: 'notAllowed' };

		const botInstance = await botManager.loadBotById(bot);
		if (botInstance == null || botInstance.ownerAccount !== account.id)
			return { result: 'notFound' };

		// Race condition check
		if (!connection.isConnected())
			return { result: 'notAllowed' };

		connection.addBotRegistration(botInstance);

		return {
			result: 'ok',
		};
	},
	botRunUnregister: ({ bot }, connection): IApiDirectoryNormalResult['botRunUnregister'] => {
		const botInstance = connection.registeredBots.get(bot);

		if (botInstance == null)
			return { result: 'notFound' };

		connection.removeBotRegistration(botInstance);

		return {
			result: 'ok',
		};
	},
	botConnect: async ({ bot, space, assignment, ifAssignmentMatches }, connection): IApiDirectoryPromiseResult['botConnect'] => {
		const account = connection.verifyTokenUseAndGetAccount(['bots:run']);
		const botInstance = connection.registeredBots.get(bot);

		if (account == null || botInstance == null)
			return { result: 'notAssigned' };

		// TODO
		return { result: 'failed' };
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
