import {
	GetLogger,
	type MessageHandlers,
} from 'pandora-common';
import type { IApiDirectory, IApiDirectoryPromiseResult } from 'pandora-common/networking/api/directory_api';
import { SpaceManager } from '../../../../spaces/spaceManager.ts';
import type { ApiConnection } from '../connection_api.ts';

/** API message handlers related to space management */
export const ApiHandlersSpaceManagement = {
	spaceCreate: async ({ config }, connection): IApiDirectoryPromiseResult['spaceCreate'] => {
		const account = connection.verifyTokenUseAndGetAccount(['spaces:create']);
		if (account == null)
			return { result: 'notAllowed' };

		// API cannot fill admin and allow lists in advance
		if (config.admin.length !== 0 || config.allow.length !== 0) {
			return { result: 'accountListNotAllowed' };
		}

		const space = await SpaceManager.createSpace(config, account);

		if (typeof space === 'string') {
			GetLogger('ApiHandlersSpaceManagement').verbose(`${connection.id} failed to create a space: ${space}`);
			return { result: space };
		}

		return {
			result: 'ok',
			id: space.id,
		};
	},
	spaceAbandon: async ({ space: spaceId }, connection): IApiDirectoryPromiseResult['spaceAbandon'] => {
		const account = connection.verifyTokenUseAndGetAccount(['spaces:disown']);
		if (account == null)
			return { result: 'notAllowed' };

		const space = await SpaceManager.loadSpace(spaceId);

		if (space == null) {
			GetLogger('ApiHandlersSpaceManagement').verbose(`${connection.id} failed manage space ownership: Space not found`);
			return { result: 'notFound' };
		}

		const result = await space.removeOwner(account.id);
		return { result };
	},
} satisfies Partial<MessageHandlers<IApiDirectory, ApiConnection>>;
