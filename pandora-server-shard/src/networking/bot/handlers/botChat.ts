import {
	BadMessageError,
	type MessageHandlers,
} from 'pandora-common';
import type { IBotShard, IBotShardNormalResult } from 'pandora-common/networking/api/shard_bot';
import type { BotConnection } from '../connection_bot.ts';

/** Bot message handlers related to chat. */
export const BotHandlersChat = {
	chatMessage: ({ messages }, connection): IBotShardNormalResult['chatMessage'] => {
		const bot = connection.bot;
		if (bot == null)
			throw new BadMessageError();

		for (const envelope of messages) {
			bot.space.handleBotMessages(envelope);
		}

		return {
			result: 'ok',
		};
	},
} satisfies Partial<MessageHandlers<IBotShard, BotConnection>>;
