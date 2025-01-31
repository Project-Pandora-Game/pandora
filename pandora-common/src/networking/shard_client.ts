import { Immutable } from 'immer';
import { z } from 'zod';
import type { AssetsDefinitionFile } from '../assets/definitions';
import { AssetFrameworkGlobalStateClientBundle } from '../assets/state/globalState';
import { AssetPreferencesPublic, CharacterIdSchema, CharacterPrivateDataSchema } from '../character';
import type { CharacterRoomPosition, ICharacterPrivateData, ICharacterPublicData } from '../character/characterData';
import { ChatCharacterStatusSchema, type IChatMessage } from '../chat/chat';
import { AppearanceActionSchema, CharacterModifierEffectDataSchema } from '../gameLogic';
import { PermissionConfigSchema, PermissionSetupSchema } from '../gameLogic/permissions/permissionData';
import { SpaceClientInfoSchema, SpaceIdSchema } from '../space/space';
import { Satisfies } from '../utility/misc';
import { ZodCast } from '../validation';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';

export type ICharacterRoomData = ICharacterPublicData & {
	assetPreferences: AssetPreferencesPublic;
	// TODO(spaces): Move this to be part of character state (roomId is used to reset position when room changes)
	position: CharacterRoomPosition;
	isOnline: boolean;
};

export const SpaceCharacterModifierEffectDataSchema = z.record(CharacterIdSchema, CharacterModifierEffectDataSchema.array());
export type SpaceCharacterModifierEffectData = z.infer<typeof SpaceCharacterModifierEffectDataSchema>;

export const SpaceLoadDataSchema = z.object({
	id: SpaceIdSchema.nullable(),
	info: SpaceClientInfoSchema,
	characters: ZodCast<ICharacterRoomData>().array(),
	characterModifierEffects: SpaceCharacterModifierEffectDataSchema,
});
export type SpaceLoadData = z.infer<typeof SpaceLoadDataSchema>;

export const GameStateUpdateSchema = z.object({
	globalState: ZodCast<AssetFrameworkGlobalStateClientBundle>().optional(),
	info: SpaceClientInfoSchema.partial().optional(),
	leave: CharacterIdSchema.optional(),
	join: ZodCast<ICharacterRoomData>().optional(),
	characters: z.record(CharacterIdSchema, ZodCast<Partial<ICharacterRoomData>>()).optional(),
	characterModifierEffects: SpaceCharacterModifierEffectDataSchema.optional(),
});
export type GameStateUpdate = z.infer<typeof GameStateUpdateSchema>;

export type IShardClientChangeEvents = 'permissions' | 'characterModifiers';

/** Shard->Client messages */
export const ShardClientSchema = {
	load: {
		request: z.object({
			character: ZodCast<ICharacterPrivateData & ICharacterRoomData>(),
			globalState: ZodCast<AssetFrameworkGlobalStateClientBundle>(),
			space: SpaceLoadDataSchema,
			assetsDefinition: ZodCast<Immutable<AssetsDefinitionFile>>(),
			assetsDefinitionHash: z.string(),
			assetsSource: z.string(),
		}),
		response: null,
	},
	updateCharacter: {
		request: CharacterPrivateDataSchema.partial(),
		response: null,
	},
	gameStateLoad: {
		request: z.object({
			globalState: ZodCast<AssetFrameworkGlobalStateClientBundle>(),
			space: SpaceLoadDataSchema,
		}),
		response: null,
	},
	gameStateUpdate: {
		request: GameStateUpdateSchema,
		response: null,
	},
	chatMessage: {
		request: z.object({
			messages: ZodCast<IChatMessage>().array(),
		}),
		response: null,
	},
	chatCharacterStatus: {
		request: z.object({
			id: CharacterIdSchema,
			status: ChatCharacterStatusSchema,
		}),
		response: null,
	},
	somethingChanged: {
		request: z.object({
			changes: ZodCast<IShardClientChangeEvents>().array(),
		}),
		response: null,
	},
	permissionPrompt: {
		request: z.object({
			characterId: CharacterIdSchema,
			requiredPermissions: z.tuple([PermissionSetupSchema, PermissionConfigSchema.nullable()]).array(),
			actions: AppearanceActionSchema.array(),
		}),
		response: null,
	},
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IShardClient = Satisfies<typeof ShardClientSchema, SocketInterfaceDefinitionVerified<typeof ShardClientSchema>>;
export type IShardClientArgument = SocketInterfaceRequest<IShardClient>;
export type IShardClientResult = SocketInterfaceHandlerResult<IShardClient>;
export type IShardClientPromiseResult = SocketInterfaceHandlerPromiseResult<IShardClient>;
export type IShardClientNormalResult = SocketInterfaceResponse<IShardClient>;
