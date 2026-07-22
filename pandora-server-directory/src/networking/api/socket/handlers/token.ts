import {
	BadMessageError,
	CloneDeepMutable,
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryNormalResult } from 'pandora-common/networking/api/directory_api';
import type { ApiConnection } from '../connection_api.ts';

/** API message handlers related to tokens */
export const ApiHandlersToken = {
	getTokenInfo: (_args, connection): IApiDirectoryNormalResult['getTokenInfo'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		const tokenInfo = account?.secure.accessTokens.getTokenInfo(connection.token) ?? null;
		if (account == null || tokenInfo == null)
			throw new BadMessageError();

		return {
			accountId: account.id,
			tokenId: tokenInfo.id,
			tokenScopes: CloneDeepMutable(tokenInfo.scopes),
			tokenExpires: tokenInfo.expires,
		};
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
