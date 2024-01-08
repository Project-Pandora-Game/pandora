import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified, SocketInterfaceDefinition } from './helpers';
import type { CharacterId } from '../character/characterTypes';
import type { CharacterRoomPosition, ICharacterPrivateData, ICharacterPublicData } from '../character/characterData';
import type { AssetsDefinitionFile } from '../assets/definitions';
import type { IChatMessage, ChatCharacterStatus } from '../chat/chat';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility';
import { AssetFrameworkGlobalStateClientBundle } from '../assets/state/globalState';
import { SpaceClientInfo, SpaceId } from '../space/space';
import { Immutable } from 'immer';

// Fix for pnpm resolution weirdness
import type { } from 'zod';
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

export type ICharacterRoomData = ICharacterPublicData & {
	// TODO(spaces): Move this to be part of character state (roomId is used to reset position when room changes)
	position: CharacterRoomPosition;
	isOnline: boolean;
};

export type SpaceLoadData = {
	id: SpaceId | null;
	info: SpaceClientInfo;
	characters: ICharacterRoomData[];
};

export type IShardClientChangeEvents = 'permissions';

/** Shard->Client messages */
export const ShardClientSchema = {
	load: {
		request: ZodCast<{
			character: ICharacterPrivateData;
			globalState: AssetFrameworkGlobalStateClientBundle;
			space: SpaceLoadData;
			assetsDefinition: Immutable<AssetsDefinitionFile>;
			assetsDefinitionHash: string;
			assetsSource: string;
		}>(),
		response: null,
	},
	updateCharacter: {
		request: ZodCast<Partial<ICharacterPrivateData>>(),
		response: null,
	},
	gameStateLoad: {
		request: ZodCast<{
			globalState: AssetFrameworkGlobalStateClientBundle;
			space: SpaceLoadData;
		}>(),
		response: null,
	},
	gameStateUpdate: {
		request: ZodCast<{
			globalState?: AssetFrameworkGlobalStateClientBundle;
			info?: Partial<SpaceClientInfo>;
			leave?: CharacterId;
			join?: ICharacterRoomData;
			characters?: Record<CharacterId, Partial<ICharacterRoomData>>;
		}>(),
		response: null,
	},
	chatMessage: {
		request: ZodCast<{
			messages: IChatMessage[];
		}>(),
		response: null,
	},
	chatCharacterStatus: {
		request: ZodCast<{
			id: CharacterId;
			status: ChatCharacterStatus;
		}>(),
		response: null,
	},
	somethingChanged: {
		request: ZodCast<{
			changes: IShardClientChangeEvents[];
		}>(),
		response: null,
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IShardClient = Satisfies<typeof ShardClientSchema, SocketInterfaceDefinitionVerified<typeof ShardClientSchema>>;
export type IShardClientArgument = SocketInterfaceRequest<IShardClient>;
export type IShardClientResult = SocketInterfaceHandlerResult<IShardClient>;
export type IShardClientPromiseResult = SocketInterfaceHandlerPromiseResult<IShardClient>;
export type IShardClientNormalResult = SocketInterfaceResponse<IShardClient>;
