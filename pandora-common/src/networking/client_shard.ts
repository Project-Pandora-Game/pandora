import { Immutable } from 'immer';
import { z } from 'zod';
import { AssetPreferencesPublicSchema } from '../character/assetPreferences';
import { CharacterPublicSettingsSchema, CharacterRoomPositionSchema } from '../character/characterData';
import { CharacterIdSchema } from '../character/characterTypes';
import { ChatCharacterStatusSchema, ClientChatMessagesSchema } from '../chat/chat';
import { PermissionConfigChangeSchema, PermissionConfigSchema, PermissionGroupSchema, PermissionSetupSchema, PermissionTypeSchema } from '../gameLogic';
import { AppearanceActionSchema } from '../gameLogic/actionLogic/actions/_index';
import { AppearanceActionData, AppearanceActionProblem } from '../gameLogic/actionLogic/appearanceActionProblems';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits';
import { Satisfies } from '../utility/misc';
import { CharacterInputNameSchema, ZodCast } from '../validation';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';

/** Client->Shard messages */
export const ClientShardSchema = {
	finishCharacterCreation: {
		request: z.object({
			name: CharacterInputNameSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'failed'; }>(),
	},
	chatMessage: {
		request: z.object({
			messages: ClientChatMessagesSchema,
			id: z.number().min(0),
			editId: z.number().min(0).optional(),
		}),
		response: null,
	},
	chatStatus: {
		request: z.object({
			status: ChatCharacterStatusSchema,
			target: CharacterIdSchema.optional(),
		}),
		response: null,
	},
	chatMessageAck: {
		request: z.object({
			lastTime: z.number().min(0),
		}),
		response: null,
	},
	roomCharacterMove: {
		request: z.object({
			id: CharacterIdSchema.optional(),
			position: CharacterRoomPositionSchema,
		}),
		response: null,
	},
	gameLogicAction: {
		request: z.discriminatedUnion('operation', [
			z.object({
				operation: z.enum(['doImmediately', 'start']),
				action: AppearanceActionSchema,
			}),
			z.object({
				operation: z.enum(['complete', 'abortCurrentAction']),
			}),
		]),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('success'),
				data: ZodCast<AppearanceActionData>().array().readonly(),
			}),
			z.object({
				result: z.literal('promptSent'),
			}),
			z.object({
				result: z.literal('promptFailedCharacterOffline'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
			}),
		]),
	},
	requestPermission: {
		request: z.object({
			target: CharacterIdSchema,
			/** List of requested permissions. If any of the permissions cannot be prompted, the request fails. */
			permissions: z.tuple([PermissionGroupSchema, z.string()]).array(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('promptSent'),
			}),
			z.object({
				result: z.literal('promptFailedCharacterOffline'),
			}),
			z.object({
				result: z.literal('failure'),
			}),
		]),
	},
	updateSettings: {
		request: CharacterPublicSettingsSchema.partial(),
		response: null,
	},
	updateAssetPreferences: {
		request: AssetPreferencesPublicSchema.partial(),
		response: z.object({
			result: z.enum(['ok', 'invalid']),
		}),
	},
	updateCharacterDescription: {
		request: z.object({
			profileDescription: z.string().max(LIMIT_CHARACTER_PROFILE_LENGTH),
		}),
		response: z.object({
			result: z.literal('ok'),
		}),
	},
	gamblingAction: {
		request: z.discriminatedUnion('type', [
			z.object({
				type: z.literal('coinFlip'),
			}),
			z.object({
				type: z.literal('diceRoll'),
				sides: z.number().int().min(2).max(100),
				dice: z.number().int().min(1).max(10),
				hidden: z.boolean().default(false).optional(),
			}),
			z.object({
				type: z.literal('rps'), // Rock Paper Scissors
				choice: z.enum(['rock', 'paper', 'scissors', 'show']),
			}),
		]),
		response: null,
	},
	permissionGet: {
		request: z.object({
			permissionGroup: PermissionGroupSchema,
			permissionId: z.string(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				permissionSetup: PermissionSetupSchema.readonly(),
				permissionConfig: PermissionConfigSchema.nullable(),
			}),
			z.object({
				result: z.literal('notFound'),
			}),
		]),
	},
	permissionSet: {
		request: z.object({
			permissionGroup: PermissionGroupSchema,
			permissionId: z.string(),
			config: PermissionConfigChangeSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.enum(['ok', 'notFound', 'invalidConfig', 'tooManyOverrides']),
			}),
		]),
	},
	permissionCheck: {
		request: z.object({
			target: CharacterIdSchema,
			permissionGroup: PermissionGroupSchema,
			permissionId: z.string(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				permission: PermissionTypeSchema,
			}),
			z.object({
				result: z.literal('notFound'),
			}),
		]),
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IClientShard = Satisfies<typeof ClientShardSchema, SocketInterfaceDefinitionVerified<typeof ClientShardSchema>>;
export type IClientShardArgument = SocketInterfaceRequest<IClientShard>;
export type IClientShardResult = SocketInterfaceHandlerResult<IClientShard>;
export type IClientShardPromiseResult = SocketInterfaceHandlerPromiseResult<IClientShard>;
export type IClientShardNormalResult = SocketInterfaceResponse<IClientShard>;
