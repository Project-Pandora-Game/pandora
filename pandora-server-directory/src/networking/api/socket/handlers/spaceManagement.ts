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

		// Only developers can create rooms with development mode enabled
		if (config.features.includes('development') && !account.roles.isAuthorized('developer')) {
			GetLogger('ApiHandlersSpaceManagement').verbose(`${connection.id} attempted to create a development space without being a developer`);
			return { result: 'notAllowed' };
		}
		// No development options allowed if the development feature is not in use
		if (config.development != null && !config.features.includes('development')) {
			GetLogger('ApiHandlersSpaceManagement').verbose(`${connection.id} attempted to create a space with development data without development feature`);
			return { result: 'failed' };
		}

		// API cannot fill admin and allow lists in advance
		if (config.admin.length !== 0 || config.allow.length !== 0) {
			return { result: 'accountListNotAllowed' };
		}

		const space = await SpaceManager.createSpace(config, [account.id]);

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
