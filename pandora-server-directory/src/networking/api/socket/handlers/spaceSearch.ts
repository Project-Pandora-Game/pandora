import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryPromiseResult } from 'pandora-common/networking/api/directory_api';
import { SpaceManager } from '../../../../spaces/spaceManager.ts';
import type { ApiConnection } from '../connection_api.ts';

/** API message handlers related to space search */
export const ApiHandlersSpaceSearch = {
	spacePublicSearch: async ({ args, limit, skip }, connection): IApiDirectoryPromiseResult['spacePublicSearch'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		if (account == null)
			throw new BadMessageError();

		return {
			result: await SpaceManager.listPublicSpaces(args, limit, skip ?? 0),
		};
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
