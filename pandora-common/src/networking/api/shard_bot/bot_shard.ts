import * as z from 'zod';
import { BotIdSchema, type BotId } from '../../../bots/botBaseTypes.ts';
import { SpaceIdSchema, type SpaceId } from '../../../space/space.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

/** Message a Bot connection uses to authenticate to a Shard. */
export interface BotShardSocketAuthMessage {
	bot: BotId;
	space: SpaceId;
	secret: string;
	version: number;
}
export const BotShardSocketAuthMessageSchema: z.ZodType<BotShardSocketAuthMessage> = z.object({
	bot: BotIdSchema,
	space: SpaceIdSchema,
	secret: z.string(),
	version: z.int().positive(),
});

/** Bit->Shard messages */
export const BotShardSchema = {
} as const satisfies SocketInterfaceDefinition;

export type IBotShard = Satisfies<typeof BotShardSchema, SocketInterfaceDefinitionVerified<typeof BotShardSchema>>;
export type IBotShardArgument = SocketInterfaceRequest<IBotShard>;
export type IBotShardResult = SocketInterfaceHandlerResult<IBotShard>;
export type IBotShardPromiseResult = SocketInterfaceHandlerPromiseResult<IBotShard>;
export type IBotShardNormalResult = SocketInterfaceResponse<IBotShard>;
