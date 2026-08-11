import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryPromiseResult } from 'pandora-common/networking/api/directory_api';
import { SpaceManager } from '../../../../spaces/spaceManager.ts';
import type { ApiConnection } from '../connection_api.ts';

/** API message handlers related to space search */
export const ApiHandlersSpaceSearch = {
	spacePublicActiveList: async (_args, connection): IApiDirectoryPromiseResult['spacePublicActiveList'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		if (account == null)
			throw new BadMessageError();

		const accountFriends = await account.contacts.getFriendsIds();

		const spaces = (await SpaceManager.listSpacesVisibleTo('everyone'))
			.map((s) => {
				const info = s.getListInfo(account, accountFriends);
				delete info.hasFriend;
				return info;
			});

		return { spaces };
	},
	spacePublicSearch: async ({ args, limit, skip }, connection): IApiDirectoryPromiseResult['spacePublicSearch'] => {
		const account = connection.verifyTokenUseAndGetAccount([]);
		if (account == null)
			throw new BadMessageError();

		return {
			result: await SpaceManager.listPublicSpaces(args, limit, skip ?? 0),
		};
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
