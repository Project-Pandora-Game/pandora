import * as z from 'zod';
import { AssetsDefinitionFileSchema } from '../../../assets/index.ts';
import { type AssetFrameworkGlobalStateClientBundle } from '../../../assets/state/globalState.ts';
import { BotPrivateDataSchema, GameStateUpdateSchema, SpaceLoadDataSchema, type IShardClientChangeEvents } from '../../../space/spaceClientData.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { ZodCast } from '../../../validation.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

/** Shard->Bot messages */
export const ShardBotSchema = {
	load: {
		request: z.object({
			botPrivate: BotPrivateDataSchema,
			globalState: ZodCast<AssetFrameworkGlobalStateClientBundle>(),
			space: SpaceLoadDataSchema,
			assetsDefinition: AssetsDefinitionFileSchema,
			assetsDefinitionHash: z.string(),
			assetsSource: z.string(),
		}),
		response: null,
	},
	updateBotPrivateData: {
		request: BotPrivateDataSchema.partial(),
		response: null,
	},
	gameStateUpdate: {
		request: GameStateUpdateSchema,
		response: null,
	},
	somethingChanged: {
		request: z.object({
			changes: ZodCast<IShardClientChangeEvents>().array(),
		}),
		response: null,
	},
} as const satisfies SocketInterfaceDefinition;

export type IShardBot = Satisfies<typeof ShardBotSchema, SocketInterfaceDefinitionVerified<typeof ShardBotSchema>>;
export type IShardBotArgument = SocketInterfaceRequest<IShardBot>;
export type IShardBotResult = SocketInterfaceHandlerResult<IShardBot>;
export type IShardBotPromiseResult = SocketInterfaceHandlerPromiseResult<IShardBot>;
export type IShardBotNormalResult = SocketInterfaceResponse<IShardBot>;
