import * as z from 'zod';
import { BotIdSchema, type BotId } from '../../../bots/botBaseTypes.ts';
import { BotChatMessageEnvelopeSchema } from '../../../chat/chat.ts';
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
	/**
	 * Send one or more messages to chat. This can contain arbitrary sequence of bot-sent messages or message edits.
	 *
	 * See {@link BotSentChatMessage} for more details on how each message looks like.
	 *
	 * This operation is atomic - if it is blocked for any reason, then NONE of the messages are sent or edited.
	 */
	chatMessage: {
		request: z.object({
			messages: BotChatMessageEnvelopeSchema.array(),
		}),
		response: z.object({
			result: z.literal('ok'),
		}),
	},
} as const satisfies SocketInterfaceDefinition;

export type IBotShard = Satisfies<typeof BotShardSchema, SocketInterfaceDefinitionVerified<typeof BotShardSchema>>;
export type IBotShardArgument = SocketInterfaceRequest<IBotShard>;
export type IBotShardResult = SocketInterfaceHandlerResult<IBotShard>;
export type IBotShardPromiseResult = SocketInterfaceHandlerPromiseResult<IBotShard>;
export type IBotShardNormalResult = SocketInterfaceResponse<IBotShard>;
