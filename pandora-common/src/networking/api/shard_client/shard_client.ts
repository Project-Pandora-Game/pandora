import * as z from 'zod';
import { AssetsDefinitionFileSchema } from '../../../assets/definitions.ts';
import { AssetFrameworkGlobalStateClientBundle, AssetFrameworkGlobalStateClientDeltaBundleSchema } from '../../../assets/state/globalState.ts';
import type { ICharacterPrivateData } from '../../../character/characterData.ts';
import { CharacterIdSchema, CharacterPrivateDataSchema } from '../../../character/index.ts';
import { ChatCharacterStatusSchema, ChatMessageSchema } from '../../../chat/chat.ts';
import { AppearanceActionSchema, CharacterRoomDataDeltaSchema, CharacterRoomDataSchema, SpaceCharacterModifierEffectDataSchema, SpaceCharacterModifierEffectDataUpdateSchema, type ICharacterRoomData } from '../../../gameLogic/index.ts';
import { PermissionConfigSchema, PermissionSetupSchema } from '../../../gameLogic/permissions/permissionData.ts';
import { SpaceIdSchema } from '../../../space/space.ts';
import { SpaceClientInfoSchema } from '../../../space/spaceData.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { ZodCast } from '../../../validation.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

export const SpaceLoadDataSchema = z.object({
	id: SpaceIdSchema.nullable(),
	info: SpaceClientInfoSchema,
	characters: CharacterRoomDataSchema.array(),
	characterModifierEffects: SpaceCharacterModifierEffectDataSchema,
	chatStatus: z.partialRecord(CharacterIdSchema, ChatCharacterStatusSchema.optional()),
});
export type SpaceLoadData = z.infer<typeof SpaceLoadDataSchema>;

export const GameStateUpdateSchema = z.object({
	globalState: AssetFrameworkGlobalStateClientDeltaBundleSchema.optional(),
	info: SpaceClientInfoSchema.partial().optional(),
	leave: CharacterIdSchema.optional(),
	join: CharacterRoomDataSchema.optional(),
	characters: z.record(CharacterIdSchema, CharacterRoomDataDeltaSchema).optional(),
	characterModifierEffects: SpaceCharacterModifierEffectDataUpdateSchema.optional(),
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
			assetsDefinition: AssetsDefinitionFileSchema,
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
			messages: ChatMessageSchema.array(),
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
} as const satisfies SocketInterfaceDefinition;

export type IShardClient = Satisfies<typeof ShardClientSchema, SocketInterfaceDefinitionVerified<typeof ShardClientSchema>>;
export type IShardClientArgument = SocketInterfaceRequest<IShardClient>;
export type IShardClientResult = SocketInterfaceHandlerResult<IShardClient>;
export type IShardClientPromiseResult = SocketInterfaceHandlerPromiseResult<IShardClient>;
export type IShardClientNormalResult = SocketInterfaceResponse<IShardClient>;
