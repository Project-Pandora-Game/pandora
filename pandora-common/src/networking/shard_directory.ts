import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified } from './helpers';
import { CharacterDataAccessSchema, CharacterDataIdSchema, CharacterDataUpdateSchema, CharacterIdSchema, ICharacterData } from '../character';
import { IDirectoryShardUpdate, ShardCharacterDefinitionSchema } from './directory_shard';
import { ChatRoomFullInfoSchema, ShardFeatureSchema } from '../chatroom';
import { z } from 'zod';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';

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
			rooms: z.array(ChatRoomFullInfoSchema),
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
	//#endregion
} as const;

export type IShardDirectory = Satisfies<typeof ShardDirectorySchema, SocketInterfaceDefinitionVerified<typeof ShardDirectorySchema>>;
export type IShardDirectoryArgument = SocketInterfaceRequest<IShardDirectory>;
export type IShardDirectoryResult = SocketInterfaceHandlerResult<IShardDirectory>;
export type IShardDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IShardDirectory>;
export type IShardDirectoryNormalResult = SocketInterfaceResponse<IShardDirectory>;
