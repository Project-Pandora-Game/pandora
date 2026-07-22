import * as z from 'zod';
import { AccountIdSchema, PandoraAccessTokenIdSchema, PandoraAccessTokenSchema, PandoraAccessTokenScopeListSchema } from '../../../account/index.ts';
import { Satisfies } from '../../../utility/misc.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

export const ApiDirectorySocketAuthMessageSchema = z.object({
	token: PandoraAccessTokenSchema,
	version: z.int().positive(),
});
export type ApiDirectorySocketAuthMessage = z.infer<typeof ApiDirectorySocketAuthMessageSchema>;

/** API->Directory messages */
export const ApiDirectorySchema = {
	/** Get info about the token that was used to authenticate to the API. */
	getTokenInfo: {
		request: z.object({}),
		response: z.object({
			accountId: AccountIdSchema,
			tokenId: PandoraAccessTokenIdSchema,
			tokenScopes: PandoraAccessTokenScopeListSchema,
			tokenExpires: z.number().nullable(),
		}),
	},
} as const satisfies SocketInterfaceDefinition;

export type IApiDirectory = Satisfies<typeof ApiDirectorySchema, SocketInterfaceDefinitionVerified<typeof ApiDirectorySchema>>;
export type IApiDirectoryArgument = SocketInterfaceRequest<IApiDirectory>;
export type IApiDirectoryResult = SocketInterfaceHandlerResult<IApiDirectory>;
export type IApiDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IApiDirectory>;
export type IApiDirectoryNormalResult = SocketInterfaceResponse<IApiDirectory>;
