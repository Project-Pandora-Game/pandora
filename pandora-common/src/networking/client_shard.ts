import { Immutable } from 'immer';
import { z } from 'zod';
import { AssetPreferencesPublicSchema } from '../character/assetPreferences.ts';
import { CharacterSettingsKeysSchema, CharacterSettingsSchema } from '../character/characterSettings.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ChatCharacterStatusSchema, ClientChatMessagesSchema } from '../chat/chat.ts';
import { AppearanceActionSchema } from '../gameLogic/actionLogic/actions/_index.ts';
import { AppearanceActionData, AppearanceActionProblem } from '../gameLogic/actionLogic/appearanceActionProblems.ts';
import { CharacterModifierConfigurationChangeSchema, CharacterModifierIdSchema, CharacterModifierInstanceClientDataSchema, CharacterModifierLockActionSchema, CharacterModifierTemplateSchema, PermissionConfigChangeSchema, PermissionConfigSchema, PermissionGroupSchema, PermissionSetupSchema, PermissionTypeSchema } from '../gameLogic/index.ts';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits.ts';
import { Satisfies } from '../utility/misc.ts';
import { CharacterInputNameSchema, ZodCast } from '../validation.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

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
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('blocked'),
				reason: z.string(),
			}),
		]),
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
	changeSettings: {
		request: z.discriminatedUnion('type', [
			z.object({
				type: z.literal('set'),
				settings: CharacterSettingsSchema.partial(),
			}),
			z.object({
				type: z.literal('reset'),
				settings: CharacterSettingsKeysSchema.array().max(CharacterSettingsKeysSchema.options.length),
			}),
		]),
		response: z.object({
			result: z.literal('ok'),
		}),
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
	characterModifiersGet: {
		request: z.object({
			target: CharacterIdSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				modifiers: CharacterModifierInstanceClientDataSchema.array(),
			}),
			z.object({
				result: z.literal('notFound'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
	characterModifierAdd: {
		request: z.object({
			target: CharacterIdSchema,
			modifier: CharacterModifierTemplateSchema,
			enabled: z.boolean(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				instanceId: CharacterModifierIdSchema,
			}),
			z.object({
				result: z.literal('characterNotFound'),
			}),
			z.object({
				result: z.literal('invalidConfiguration'),
			}),
			z.object({
				result: z.literal('tooManyModifiers'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
	characterModifierReorder: {
		request: z.object({
			target: CharacterIdSchema,
			modifier: CharacterModifierIdSchema,
			shift: z.number().int(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('characterNotFound'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
	characterModifierDelete: {
		request: z.object({
			target: CharacterIdSchema,
			modifier: CharacterModifierIdSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('characterNotFound'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
	characterModifierConfigure: {
		request: z.object({
			target: CharacterIdSchema,
			modifier: CharacterModifierIdSchema,
			config: CharacterModifierConfigurationChangeSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('characterNotFound'),
			}),
			z.object({
				result: z.literal('invalidConfiguration'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
	characterModifierLock: {
		request: z.object({
			target: CharacterIdSchema,
			modifier: CharacterModifierIdSchema,
			action: CharacterModifierLockActionSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				password: z.string().optional(),
			}),
			z.object({
				result: z.literal('characterNotFound'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
				canPrompt: z.boolean(),
			}),
		]),
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IClientShard = Satisfies<typeof ClientShardSchema, SocketInterfaceDefinitionVerified<typeof ClientShardSchema>>;
export type IClientShardArgument = SocketInterfaceRequest<IClientShard>;
export type IClientShardResult = SocketInterfaceHandlerResult<IClientShard>;
export type IClientShardPromiseResult = SocketInterfaceHandlerPromiseResult<IClientShard>;
export type IClientShardNormalResult = SocketInterfaceResponse<IClientShard>;
