import { Immutable } from 'immer';
import type { AssetsDefinitionFile } from '../assets/definitions';
import { AssetFrameworkGlobalStateClientBundle } from '../assets/state/globalState';
import { AssetPreferencesPublic } from '../character';
import type { CharacterRoomPosition, ICharacterPrivateData, ICharacterPublicData } from '../character/characterData';
import type { CharacterId } from '../character/characterTypes';
import type { ChatCharacterStatus, IChatMessage } from '../chat/chat';
import { SpaceClientInfo, SpaceId } from '../space/space';
import { Satisfies } from '../utility';
import { ZodCast } from '../validation';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';
import type { PermissionConfig, PermissionSetup } from '../gameLogic/permissions/permissionData';

// Fix for pnpm resolution weirdness
import type { } from 'zod';
import type { } from '../assets/appearance';
import type { } from '../character/pronouns';

export type ICharacterRoomData = ICharacterPublicData & {
	assetPreferences: AssetPreferencesPublic;
	// TODO(spaces): Move this to be part of character state (roomId is used to reset position when room changes)
	position: CharacterRoomPosition;
	isOnline: boolean;
};

export type SpaceLoadData = {
	id: SpaceId | null;
	info: SpaceClientInfo;
	characters: ICharacterRoomData[];
};

export type GameStateUpdate = {
	globalState?: AssetFrameworkGlobalStateClientBundle;
	info?: Partial<SpaceClientInfo>;
	leave?: CharacterId;
	join?: ICharacterRoomData;
	characters?: Record<CharacterId, Partial<ICharacterRoomData>>;
};

export type IShardClientChangeEvents = 'permissions';

/** Shard->Client messages */
export const ShardClientSchema = {
	load: {
		request: ZodCast<{
			character: ICharacterPrivateData & ICharacterRoomData;
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
		request: ZodCast<GameStateUpdate>(),
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
	permissionPrompt: {
		request: ZodCast<{
			characterId: CharacterId;
			requiredPermissions: [PermissionSetup, PermissionConfig | null][];
			messages: IChatMessage[];
		}>(),
		response: null,
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IShardClient = Satisfies<typeof ShardClientSchema, SocketInterfaceDefinitionVerified<typeof ShardClientSchema>>;
export type IShardClientArgument = SocketInterfaceRequest<IShardClient>;
export type IShardClientResult = SocketInterfaceHandlerResult<IShardClient>;
export type IShardClientPromiseResult = SocketInterfaceHandlerPromiseResult<IShardClient>;
export type IShardClientNormalResult = SocketInterfaceResponse<IShardClient>;
