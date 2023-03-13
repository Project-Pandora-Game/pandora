import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified } from './helpers';
import { CharacterDataAccessSchema, CharacterDataIdSchema, CharacterDataUpdateSchema, CharacterIdSchema, ICharacterData } from '../character';
import { IDirectoryShardUpdate, ShardCharacterDefinitionSchema, ShardChatRoomDefinitionSchema } from './directory_shard';
import { ChatRoomDataSchema, ChatRoomDataShardUpdateSchema, IChatRoomData, RoomIdSchema, ShardFeatureSchema } from '../chatroom';
import { z } from 'zod';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';

export const ChatRoomDataAccessSchema = ChatRoomDataSchema.pick({ id: true, accessId: true });
export type IChatRoomDataAccess = z.infer<typeof ChatRoomDataAccessSchema>;

// Fix for pnpm resolution weirdness
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

export const ShardDirectorySchema = {
	shardRegister: {
		request: z.object({
			shardId: z.string().nullable(),
			publicURL: z.string(),
			features: z.array(ShardFeatureSchema),
			version: z.string(),
			characters: z.array(ShardCharacterDefinitionSchema),
			disconnectCharacters: z.array(CharacterIdSchema),
			rooms: z.array(ShardChatRoomDefinitionSchema.pick({ id: true, accessId: true })),
		}),
		response: ZodCast<IDirectoryShardUpdate & {
			shardId: string;
		}>(),
	},
	shardRequestStop: {
		request: z.object({}),
		response: null,
	},
	characterDisconnect: {
		request: z.object({
			id: CharacterIdSchema,
			reason: z.enum(['timeout', 'error']),
		}),
		response: null,
	},
	roomUnload: {
		request: z.object({
			id: RoomIdSchema,
			reason: z.enum(['error']),
		}),
		response: null,
	},

	createCharacter: {
		request: CharacterDataIdSchema,
		response: ZodCast<ICharacterData>(),
	},

	//#region Database
	getCharacter: {
		request: CharacterDataAccessSchema,
		response: ZodCast<ICharacterData>(),
	},
	setCharacter: {
		request: CharacterDataUpdateSchema,
		response: ZodCast<{ result: 'success' | 'invalidAccessId'; }>(),
	},
	getChatRoom: {
		request: ChatRoomDataAccessSchema,
		response: ZodCast<IChatRoomData>(),
	},
	setChatRoom: {
		request: z.object({
			id: RoomIdSchema,
			accessId: z.string(),
			data: ChatRoomDataShardUpdateSchema,
		}),
		response: ZodCast<{ result: 'success' | 'invalidAccessId'; }>(),
	},
	//#endregion
} as const;

export type IShardDirectory = Satisfies<typeof ShardDirectorySchema, SocketInterfaceDefinitionVerified<typeof ShardDirectorySchema>>;
export type IShardDirectoryArgument = SocketInterfaceRequest<IShardDirectory>;
export type IShardDirectoryResult = SocketInterfaceHandlerResult<IShardDirectory>;
export type IShardDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IShardDirectory>;
export type IShardDirectoryNormalResult = SocketInterfaceResponse<IShardDirectory>;
