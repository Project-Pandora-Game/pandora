import { CharacterIdSchema } from '../character/characterTypes';
import { CharacterPublicSettingsSchema } from '../character/characterData';
import { AppearanceActionSchema } from '../assets/appearanceActions';
import { AppearanceActionProblem } from '../assets/appearanceActionProblems';
import { ClientMessageSchema, ChatRoomStatusSchema } from '../chatroom/chat';
import { z } from 'zod';
import { CharacterInputNameSchema, ZodCast } from '../validation';
import { Satisfies } from '../utility';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';
import { Immutable } from 'immer';
import { PermissionConfigSchema, PermissionGroupSchema, PermissionSetupSchema } from '../gameLogic';
import { LIMIT_CHARACTER_PROFILE_LENGTH } from '../inputLimits';

// Fix for pnpm resolution weirdness
import type { } from '../assets/item';
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

/** Client->Shard messages */
export const ClientShardSchema = {
	finishCharacterCreation: {
		request: z.object({
			name: CharacterInputNameSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'failed'; }>(),
	},
	chatRoomMessage: {
		request: z.object({
			messages: z.array(ClientMessageSchema),
			id: z.number().min(0),
			editId: z.number().min(0).optional(),
		}),
		response: null,
	},
	chatRoomStatus: {
		request: z.object({
			status: ChatRoomStatusSchema,
			target: CharacterIdSchema.optional(),
		}),
		response: null,
	},
	chatRoomMessageAck: {
		request: z.object({
			lastTime: z.number().min(0),
		}),
		response: null,
	},
	chatRoomCharacterMove: {
		request: z.object({
			id: CharacterIdSchema.optional(),
			position: z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int()]),
		}),
		response: null,
	},
	appearanceAction: {
		request: AppearanceActionSchema,
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('success'),
			}),
			z.object({
				result: z.literal('failure'),
				problems: ZodCast<AppearanceActionProblem>().array(),
			}),
		]),
	},
	updateSettings: {
		request: CharacterPublicSettingsSchema.partial(),
		response: null,
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
			config: PermissionConfigSchema.nullable(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('notFound'),
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
			}),
			z.object({
				result: z.literal('noAccess'),
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
