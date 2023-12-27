import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified, SocketInterfaceDefinition } from './helpers';
import { CharacterIdSchema } from '../character/characterTypes';
import { CharacterDataSchema, CharacterDataShardUpdateSchema, ICharacterData } from '../character/characterData';
import { DirectoryShardUpdateSchema, ShardCharacterDefinitionSchema, ShardChatRoomDefinitionSchema } from './directory_shard';
import { ChatRoomDataShardUpdateSchema, IChatRoomData, RoomIdSchema, ShardFeatureSchema } from '../chatroom/room';
import { z } from 'zod';
import { Satisfies } from '../utility';
import { ZodCast } from '../validation';
import { Immutable } from 'immer';

// Fix for pnpm resolution weirdness
import type { } from '../assets/appearance';
import type { } from '../assets/item';
import type { } from '../character/pronouns';
import type { } from '../chatroom/chat';

export const ShardDirectorySchema = {
	shardRegister: {
		request: z.object({
			publicURL: z.string(),
			features: z.array(ShardFeatureSchema),
			version: z.string(),
			characters: z.array(ShardCharacterDefinitionSchema),
			disconnectCharacters: z.array(CharacterIdSchema),
			rooms: z.array(ShardChatRoomDefinitionSchema.pick({ id: true, accessId: true })),
		}),
		response: DirectoryShardUpdateSchema.extend({
			shardId: z.string(),
		}),
	},
	shardRequestStop: {
		request: z.object({}),
		response: null,
	},
	characterClientDisconnect: {
		request: z.object({
			id: CharacterIdSchema,
			reason: z.enum(['timeout']),
		}),
		response: null,
	},
	characterError: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: null,
	},
	roomError: {
		request: z.object({
			id: RoomIdSchema,
		}),
		response: null,
	},

	createCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: CharacterDataSchema,
	},

	//#region Database
	getCharacter: {
		request: z.object({
			id: CharacterIdSchema,
			accessId: z.string(),
		}),
		response: z.object({
			// Response is intentionally not checked, as DB might contain outdated data and migration happens on the shard
			result: ZodCast<ICharacterData>().nullable(),
		}),
	},
	setCharacter: {
		request: z.object({
			id: CharacterIdSchema,
			accessId: z.string(),
			data: CharacterDataShardUpdateSchema,
		}),
		response: z.object({
			result: z.enum(['success', 'invalidAccessId']),
		}),
	},
	getChatRoom: {
		request: z.object({
			id: RoomIdSchema,
			accessId: z.string(),
		}),
		response: z.object({
			// Response is intentionally not checked, as DB might contain outdated data and migration happens on the shard
			result: ZodCast<IChatRoomData>().nullable(),
		}),
	},
	setChatRoom: {
		request: z.object({
			id: RoomIdSchema,
			accessId: z.string(),
			data: ChatRoomDataShardUpdateSchema,
		}),
		response: z.object({
			result: z.enum(['success', 'invalidAccessId']),
		}),
	},
	//#endregion
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IShardDirectory = Satisfies<typeof ShardDirectorySchema, SocketInterfaceDefinitionVerified<typeof ShardDirectorySchema>>;
export type IShardDirectoryArgument = SocketInterfaceRequest<IShardDirectory>;
export type IShardDirectoryResult = SocketInterfaceHandlerResult<IShardDirectory>;
export type IShardDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IShardDirectory>;
export type IShardDirectoryNormalResult = SocketInterfaceResponse<IShardDirectory>;
