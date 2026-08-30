import * as z from 'zod';
import { AccountIdSchema, PandoraAccessTokenIdSchema, PandoraAccessTokenNameSchema, PandoraAccessTokenSchema, PandoraAccessTokenScopeListSchema } from '../../../account/index.ts';
import { BotIdSchema } from '../../../bots/botBaseTypes.ts';
import { BotShardConnectionInfoSchema, BotSpaceAssignmentApiDataSchema } from '../../../bots/botDirectoryState.ts';
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

	//#region Bots

	/** Register this connection as one running bot with specific id. Requires the owner account to own this bot and the `bots:run` scope.
	 * After the connection is registered for running the specified bot, the connection will start receiving the `botStateChanged` event.
	 *
	 * Note, that the registration **needs to happen after every re-connect** as well!
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	botRunRegister: {
		request: z.object({
			bot: BotIdSchema,
		}),
		response: z.object({
			result: z.enum([
				'ok',
				'notAllowed', // Missing token scopes
				'notFound', // Bot not found or not owned by the token's account
			]),
		}),
	},
	/** Stops receiving events related to bot registered using `botRunRegister`.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	botRunUnregister: {
		request: z.object({
			bot: BotIdSchema,
		}),
		response: z.object({
			result: z.enum([
				'ok',
				'notFound', // Bot is not registered by this connection
			]),
		}),
	},

	/** Connect to a bot's presence in an active space, returning credentials that can be used to connect to matching Shard.
	 * Can only be done on the same connection as `botRunRegister`.
	 *
	 * If `ifAssignmentMatches` is specified (not `undefined`), then the connection happens only if current assignment matches the one provided.
	 * This can be used to avoid race condition with multiple orchestrators running at the same time.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	botConnect: {
		request: z.object({
			bot: BotIdSchema,
			space: SpaceIdSchema,
			assignment: BotSpaceAssignmentApiDataSchema,
			ifAssignmentMatches: BotSpaceAssignmentApiDataSchema.nullable().optional(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				shardConnection: BotShardConnectionInfoSchema,
			}),
			z.object({
				result: z.literal([
					'notActive', // The space became inactive in the interval before last bot state update and this request
					'notAssigned', // The bot is no longer assigned to this space
					'registrationRequired', // Only connections with active `botRunRegister` can do this action.
					'assignmentMismatch', // `ifAssignmentMatches` not satisfied
					'failed', // Internal error - try again later
				]),
			}),
		]),
	},

	//#endregion

} as const satisfies SocketInterfaceDefinition;

export type IApiDirectory = Satisfies<typeof ApiDirectorySchema, SocketInterfaceDefinitionVerified<typeof ApiDirectorySchema>>;
export type IApiDirectoryArgument = SocketInterfaceRequest<IApiDirectory>;
export type IApiDirectoryResult = SocketInterfaceHandlerResult<IApiDirectory>;
export type IApiDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IApiDirectory>;
export type IApiDirectoryNormalResult = SocketInterfaceResponse<IApiDirectory>;
