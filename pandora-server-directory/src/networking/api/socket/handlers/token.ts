import {
	BadMessageError,
	CloneDeepMutable,
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryNormalResult, IApiDirectoryPromiseResult } from 'pandora-common/networking/api/directory_api';
import type { ApiConnection } from '../connection_api.ts';

/** API message handlers related to tokens */
export const ApiHandlersToken = {
	getTokenInfo: (_args, connection): IApiDirectoryNormalResult['getTokenInfo'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		const tokenInfo = account?.secure.accessTokens.getTokenInfo(connection.tokenHash) ?? null;
		if (account == null || tokenInfo == null)
			throw new BadMessageError();

		return {
			accountId: account.id,
			tokenId: tokenInfo.id,
			tokenName: tokenInfo.name,
			tokenScopes: CloneDeepMutable(tokenInfo.scopes),
			tokenExpires: tokenInfo.expires,
		};
	},
	deleteToken: async ({ tokenId }, connection): IApiDirectoryPromiseResult['deleteToken'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		const currentTokenId = connection.tokenId;

		// Currently only deleting the token that is being used is allowed
		if (account == null || tokenId != null && tokenId !== currentTokenId) {
			return {
				result: 'notAllowed',
			};
		}

		const deleteResult = await account.secure.accessTokens.deleteToken(tokenId ?? currentTokenId);

		return {
			result: deleteResult ? 'ok' : 'notFound',
		};
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
