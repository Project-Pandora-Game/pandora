import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult, DefineSocketInterface } from './helpers';
import type { MessageHandler } from './message_handler';
import { CharacterDataAccessSchema, CharacterDataIdSchema, CharacterDataUpdateSchema, CharacterIdSchema, ICharacterData } from '../character';
import { IDirectoryShardUpdate, ShardCharacterDefinitionSchema } from './directory_shard';
import { ChatRoomFullInfoSchema, ShardFeatureSchema } from '../chatroom';
import { z } from 'zod';

export const ShardDirectoryInSchema = z.object({
	shardRegister: z.object({
		shardId: z.string().nullable(),
		publicURL: z.string(),
		features: z.array(ShardFeatureSchema),
		version: z.string(),
		characters: z.array(ShardCharacterDefinitionSchema),
		disconnectCharacters: z.array(CharacterIdSchema),
		rooms: z.array(ChatRoomFullInfoSchema),
	}),
	shardRequestStop: z.object({}),
	characterDisconnect: z.object({
		id: CharacterIdSchema,
		reason: z.enum(['timeout', 'error']),
	}),

	createCharacter: CharacterDataIdSchema,

	//#region Database
	getCharacter: CharacterDataAccessSchema,
	setCharacter: CharacterDataUpdateSchema,
	//#endregion
});

export type ShardDirectoryIn = z.infer<typeof ShardDirectoryInSchema>;

export type ShardDirectoryOut = {
	shardRegister: IDirectoryShardUpdate & {
		shardId: string;
	};
	createCharacter: ICharacterData;
	getCharacter: ICharacterData;
	setCharacter: { result: 'success' | 'invalidAccessId'; };
};

export type IShardDirectoryBase = DefineSocketInterface<ShardDirectoryIn, ShardDirectoryOut>;
export type IShardDirectory = SocketInterface<IShardDirectoryBase>;
export type IShardDirectoryArgument = RecordOnly<SocketInterfaceArgs<IShardDirectoryBase>>;
export type IShardDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<IShardDirectoryBase>;
export type IShardDirectoryResult = SocketInterfaceResult<IShardDirectoryBase>;
export type IShardDirectoryPromiseResult = SocketInterfacePromiseResult<IShardDirectoryBase>;
export type IShardDirectoryNormalResult = SocketInterfaceNormalResult<IShardDirectoryBase>;
export type IShardDirectoryResponseHandler = SocketInterfaceResponseHandler<IShardDirectoryBase>;
export type IShardDirectoryOneshotHandler = SocketInterfaceOneshotHandler<IShardDirectoryBase>;
export type IShardDirectoryMessageHandler<Context> = MessageHandler<IShardDirectoryBase, Context>;
