import * as z from 'zod';
import { AccountIdSchema, PandoraAccessTokenIdSchema, PandoraAccessTokenNameSchema, PandoraAccessTokenSchema, PandoraAccessTokenScopeListSchema } from '../../../account/index.ts';
import { LIMIT_SPACE_SEARCH_COUNT } from '../../../inputLimits.ts';
import type { SpaceListInfo } from '../../../space/space.ts';
import { SpaceSearchArgumentsSchema, SpaceSearchResultSchema } from '../../../space/spaceSearch.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { ZodCast } from '../../../validation.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

export const ApiDirectorySocketAuthMessageSchema = z.object({
	token: PandoraAccessTokenSchema,
	version: z.int().positive(),
});
export type ApiDirectorySocketAuthMessage = z.infer<typeof ApiDirectorySocketAuthMessageSchema>;

/** API->Directory messages */
export const ApiDirectorySchema = {
	//#region Tokens

	/** Get info about the token that was used to authenticate to the API. */
	getTokenInfo: {
		request: z.object({}),
		response: z.object({
			accountId: AccountIdSchema,
			tokenId: PandoraAccessTokenIdSchema,
			tokenName: PandoraAccessTokenNameSchema,
			tokenScopes: PandoraAccessTokenScopeListSchema,
			tokenExpires: z.number().nullable(),
		}),
	},
	/** Delete the specified token. Currently supports only deleting the very token that is being used. */
	deleteToken: {
		request: z.object({
			/** Id of the token to delete. `null` = own token. */
			tokenId: PandoraAccessTokenIdSchema.nullable(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({ result: z.literal('ok') }),
			z.object({ result: z.literal('notAllowed') }),
			z.object({ result: z.literal('notFound') }),
		]),
	},

	//#endregion

	//#region Space search

	/** Get list of currently active fully public spaces. Does NOT return the same list as client -
	 * Spaces that are private but visible to the current account are NOT included.
	 */
	spacePublicActiveList: {
		request: z.object({}),
		response: z.object({
			spaces: ZodCast<Omit<SpaceListInfo, 'hasFriend'>>().array(),
		}),
	},
	/** Search through all public spaces */
	spacePublicSearch: {
		request: z.object({
			args: SpaceSearchArgumentsSchema,
			limit: z.int().positive().max(LIMIT_SPACE_SEARCH_COUNT),
			skip: z.number().int().nonnegative().optional(),
		}),
		response: z.object({
			result: SpaceSearchResultSchema,
		}),
	},
	/** Get list of spaces owned by the current account. Requires the `spaces:list_owned` token scope. */
	spaceOwnedList: {
		request: z.object({}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				spaces: ZodCast<Omit<SpaceListInfo, 'hasFriend'>>().array(),
			}),
			z.object({ result: z.literal('notAllowed') }),
		]),
	},

	//#endregion

} as const satisfies SocketInterfaceDefinition;

export type IApiDirectory = Satisfies<typeof ApiDirectorySchema, SocketInterfaceDefinitionVerified<typeof ApiDirectorySchema>>;
export type IApiDirectoryArgument = SocketInterfaceRequest<IApiDirectory>;
export type IApiDirectoryResult = SocketInterfaceHandlerResult<IApiDirectory>;
export type IApiDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IApiDirectory>;
export type IApiDirectoryNormalResult = SocketInterfaceResponse<IApiDirectory>;
