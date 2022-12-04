import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified } from './helpers';
import type { CharacterId, ICharacterData, ICharacterPublicData } from '../character';
import type { IChatRoomFullInfo } from '../chatroom';
import type { AssetsDefinitionFile } from '../assets/definitions';
import type { IChatRoomMessage, IChatRoomStatus } from '../chatroom/chat';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';

// Fix for pnpm resolution weirdness
import type { } from 'zod';
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

export type ICharacterRoomData = ICharacterPublicData & {
	position: [number, number];
};

export type IChatRoomClientData = IChatRoomFullInfo & {
	characters: ICharacterRoomData[];
};

export type IChatRoomUpdate = {
	room: null | IChatRoomClientData;
} | {
	info?: Partial<IChatRoomClientData>;
	leave?: CharacterId;
	join?: ICharacterRoomData;
	update?: Pick<ICharacterRoomData, 'id'> & Partial<ICharacterRoomData>;
};

/** Shard->Client messages */
export const ShardClientSchema = {
	load: {
		request: ZodCast<{
			character: ICharacterData;
			room: null | IChatRoomClientData;
			assetsDefinition: AssetsDefinitionFile;
			assetsDefinitionHash: string;
			assetsSource: string;
		}>(),
		response: null,
	},
	updateCharacter: {
		request: ZodCast<Partial<ICharacterData>>(),
		response: null,
	},
	chatRoomUpdate: {
		request: ZodCast<IChatRoomUpdate>(),
		response: null,
	},
	chatRoomMessage: {
		request: ZodCast<{
			messages: IChatRoomMessage[];
		}>(),
		response: null,
	},
	chatRoomStatus: {
		request: ZodCast<{
			id: CharacterId;
			status: IChatRoomStatus;
		}>(),
		response: null,
	},
} as const;

export type IShardClient = Satisfies<typeof ShardClientSchema, SocketInterfaceDefinitionVerified<typeof ShardClientSchema>>;
export type IShardClientArgument = SocketInterfaceRequest<IShardClient>;
export type IShardClientResult = SocketInterfaceHandlerResult<IShardClient>;
export type IShardClientPromiseResult = SocketInterfaceHandlerPromiseResult<IShardClient>;
export type IShardClientNormalResult = SocketInterfaceResponse<IShardClient>;
