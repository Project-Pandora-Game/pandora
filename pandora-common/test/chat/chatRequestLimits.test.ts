import { describe, expect, it } from '@jest/globals';
import { ClientChatMessagesSchema } from '../../src/chat/chat.ts';
import { LIMIT_CHAT_MESSAGES_PER_REQUEST, LIMIT_CHAT_SEGMENTS_PER_REQUEST, LIMIT_PERMISSION_PROMPT_ENTRIES, LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS, LIMIT_SPACE_MAX_CHARACTER_NUMBER } from '../../src/inputLimits.ts';
import { ClientShardSchema } from '../../src/networking/api/shard_client/client_shard.ts';

describe('client chat request limits', () => {
	const message = { type: 'chat', parts: [['normal', 'hello']] };

	it('bounds the number of logical messages even if they contain no text', () => {
		const emptyMessage = { type: 'chat', parts: [] };
		expect(ClientChatMessagesSchema.safeParse(Array.from({ length: LIMIT_CHAT_MESSAGES_PER_REQUEST }, () => emptyMessage)).success).toBe(true);
		expect(ClientChatMessagesSchema.safeParse(Array.from({ length: LIMIT_CHAT_MESSAGES_PER_REQUEST + 1 }, () => emptyMessage)).success).toBe(false);
	});

	it('bounds formatting segments across the complete request', () => {
		const segments = Array.from({ length: LIMIT_CHAT_SEGMENTS_PER_REQUEST }, () => ['normal', ''] as const);
		expect(ClientChatMessagesSchema.safeParse([{ type: 'chat', parts: segments }]).success).toBe(true);
		expect(ClientChatMessagesSchema.safeParse([{ type: 'chat', parts: [...segments, ['normal', '']] }]).success).toBe(false);
		expect(ClientChatMessagesSchema.safeParse([
			{ type: 'chat', parts: segments.slice(0, 400) },
			{ type: 'chat', parts: segments.slice(0, 113) },
		]).success).toBe(false);
	});

	it('bounds recipient and permission lists', () => {
		const maxRecipients = LIMIT_SPACE_MAX_CHARACTER_NUMBER + LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS;
		expect(ClientChatMessagesSchema.safeParse([{ ...message, to: Array.from({ length: maxRecipients }, (_, i) => `c${i}`) }]).success).toBe(true);
		expect(ClientChatMessagesSchema.safeParse([{ ...message, to: Array.from({ length: maxRecipients + 1 }, (_, i) => `c${i}`) }]).success).toBe(false);

		const permission = ['interaction', 'test'];
		const request = (length: number) => ({ target: 'c1', permissions: Array.from({ length }, () => permission) });
		expect(ClientShardSchema.requestPermission.request.safeParse(request(0)).success).toBe(false);
		expect(ClientShardSchema.requestPermission.request.safeParse(request(LIMIT_PERMISSION_PROMPT_ENTRIES)).success).toBe(true);
		expect(ClientShardSchema.requestPermission.request.safeParse(request(LIMIT_PERMISSION_PROMPT_ENTRIES + 1)).success).toBe(false);
	});
});
