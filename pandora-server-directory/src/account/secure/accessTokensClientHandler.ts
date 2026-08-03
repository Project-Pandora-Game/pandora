import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IClientDirectory, IClientDirectoryNormalResult, IClientDirectoryPromiseResult } from 'pandora-common/networking/api/directory_client';
import type { ClientConnection } from '../../networking/connection_client.ts';

export const AccessTokensClientHandler = {
	accessTokensList: (_args, connection): IClientDirectoryNormalResult['accessTokensList'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		return {
			tokens: account.secure.accessTokens.listTokens(),
		};
	},
	accessTokensCreate: async ({ name, scopes, expires }, connection): IClientDirectoryPromiseResult['accessTokensCreate'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const result = await account.secure.accessTokens.createToken(name, scopes, expires);
		if (typeof result === 'string')
			return { result };

		const [token, tokenData] = result;

		return {
			result: 'ok',
			token,
			info: {
				id: tokenData.id,
				name: tokenData.name,
				scopes: tokenData.scopes,
				created: tokenData.created,
				lastUsed: tokenData.lastUsed,
				expires: tokenData.expires,
			},
		};
	},
	accessTokenDelete: async ({ id }, connection): IClientDirectoryPromiseResult['accessTokenDelete'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const result = await account.secure.accessTokens.deleteToken(id);

		return {
			result: result ? 'ok' : 'notFound',
		};
	},
	accessTokenUpdate: async ({ id, name, scopes }, connection): IClientDirectoryPromiseResult['accessTokenUpdate'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const result = await account.secure.accessTokens.updateToken(id, name, scopes);

		return {
			result: result ? 'ok' : 'notFound',
		};
	},
	accessTokenRegenerate: async ({ id, expires }, connection): IClientDirectoryPromiseResult['accessTokenRegenerate'] => {
		const account = connection.account;
		if (account == null)
			throw new BadMessageError();

		if (!connection.hasSudo())
			return { result: 'sudoRequired' };

		const result = await account.secure.accessTokens.regenerateToken(id, expires);
		if (typeof result === 'string')
			return { result };

		return {
			result: 'ok',
			token: result[0],
		};
	},
} satisfies Partial<MessageHandlers<IClientDirectory, ClientConnection>>;
