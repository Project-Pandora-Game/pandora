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

		const spaces = (await SpaceManager.listSpacesVisibleTo('everyone'))
			.map((s) => {
				const info = s.getListInfo(account, new Set());
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
	spaceOwnedList: async (_args, connection): IApiDirectoryPromiseResult['spaceOwnedList'] => {
		const account = connection.verifyTokenUseAndGetAccount(['spaces:list_owned']);
		if (account == null)
			return { result: 'notAllowed' };

		const spaces = (await SpaceManager.listOwnedSpaces(account))
			.map((s) => {
				const info = s.getListInfo(account, new Set());
				delete info.hasFriend;
				return info;
			});

		return {
			result: 'ok',
			spaces,
		};
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
