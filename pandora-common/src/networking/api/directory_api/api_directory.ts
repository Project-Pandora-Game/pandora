import * as z from 'zod';
import { AccountIdSchema, PandoraAccessTokenIdSchema, PandoraAccessTokenNameSchema, PandoraAccessTokenSchema, PandoraAccessTokenScopeListSchema } from '../../../account/index.ts';
import { LIMIT_SPACE_SEARCH_COUNT } from '../../../inputLimits.ts';
import { SpaceIdSchema, type SpaceListInfo } from '../../../space/space.ts';
import { SpaceDirectoryConfigSchema } from '../../../space/spaceData.ts';
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

	//#region Space management

	/** Create a new space. Requires the `spaces:create` token scope.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	spaceCreate: {
		request: z.object({
			config: SpaceDirectoryConfigSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				id: SpaceIdSchema,
			}),
			z.object({
				result: z.enum([
					'notAllowed', // Missing token scopes
					'spaceOwnershipLimitReached',
					'accountListNotAllowed', // API cannot fill admin and allow lists in advance - add accounts after target character joins the space
					'failed', // Generic failure
				]),
			}),
		]),
	},
	/** Drop own ownership of a space. Requires the `spaces:disown` token scope.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	spaceAbandon: {
		request: z.object({
			space: SpaceIdSchema,
		}),
		response: z.object({
			result: z.enum([
				'ok',
				'notAllowed', // Missing token scopes
				'notFound', // Space not found
				'notAnOwner', // You need to be an owner of the space to do this
				'failed', // Generic failure
			]),
		}),
	},

	//#endregion

} as const satisfies SocketInterfaceDefinition;

export type IApiDirectory = Satisfies<typeof ApiDirectorySchema, SocketInterfaceDefinitionVerified<typeof ApiDirectorySchema>>;
export type IApiDirectoryArgument = SocketInterfaceRequest<IApiDirectory>;
export type IApiDirectoryResult = SocketInterfaceHandlerResult<IApiDirectory>;
export type IApiDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IApiDirectory>;
export type IApiDirectoryNormalResult = SocketInterfaceResponse<IApiDirectory>;
