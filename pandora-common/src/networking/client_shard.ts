import { CharacterIdSchema } from '../character/characterTypes';
import { CharacterDataCreateSchema, CharacterPublicSettingsSchema } from '../character/characterData';
import { AppearanceActionSchema } from '../assets/appearanceActions';
import { AppearanceActionProblem } from '../assets/appearanceActionProblems';
import { ClientMessageSchema, ChatRoomStatusSchema } from '../chatroom/chat';
import { z } from 'zod';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';
import { SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';

// Fix for pnpm resolution weirdness
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

/** Client->Shard messages */
export const ClientShardSchema = {
	finishCharacterCreation: {
		request: CharacterDataCreateSchema,
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
		]),
		response: null,
	},
} as const;

export type IClientShard = Satisfies<typeof ClientShardSchema, SocketInterfaceDefinitionVerified<typeof ClientShardSchema>>;
export type IClientShardArgument = SocketInterfaceRequest<IClientShard>;
export type IClientShardResult = SocketInterfaceHandlerResult<IClientShard>;
export type IClientShardPromiseResult = SocketInterfaceHandlerPromiseResult<IClientShard>;
export type IClientShardNormalResult = SocketInterfaceResponse<IClientShard>;
