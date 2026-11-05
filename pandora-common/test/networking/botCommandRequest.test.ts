import { describe, expect, it } from '@jest/globals';
import { LIMIT_BOT_COMMAND_ARGUMENT_COUNT, LIMIT_BOT_COMMAND_INPUT_LENGTH, LIMIT_BOT_COMMAND_NAME_LENGTH } from '../../src/inputLimits.ts';
import { ClientShardSchema } from '../../src/networking/api/shard_client/client_shard.ts';

const request = { bot: `bot:${'a'.repeat(32)}`, command: 'test', args: ['argument'] };

describe('bot command client requests', () => {
	for (const kind of ['botCommandRun', 'botCommandGetStructurePart'] as const) {
		it(`${kind} accepts commands and argument counts representable within a chat message`, () => {
			const schema = ClientShardSchema[kind].request;
			expect(schema.safeParse(request).success).toBe(true);
			expect(schema.safeParse({ ...request, command: 'x'.repeat(LIMIT_BOT_COMMAND_NAME_LENGTH), args: [] }).success).toBe(true);
			expect(schema.safeParse({ ...request, args: Array(Math.floor((LIMIT_BOT_COMMAND_INPUT_LENGTH - request.command.length) / 2)).fill('x') }).success).toBe(true);
			expect(schema.safeParse({ ...request, args: Array(LIMIT_BOT_COMMAND_ARGUMENT_COUNT).fill('') }).success).toBe(true);
		});

		it(`${kind} still bounds oversized names, argument arrays, and total input`, () => {
			const schema = ClientShardSchema[kind].request;
			expect(schema.safeParse({ ...request, command: 'x'.repeat(LIMIT_BOT_COMMAND_NAME_LENGTH + 1), args: [] }).success).toBe(false);
			expect(schema.safeParse({ ...request, args: Array(LIMIT_BOT_COMMAND_ARGUMENT_COUNT + 1).fill('') }).success).toBe(false);
			expect(schema.safeParse({ ...request, args: ['x'.repeat(LIMIT_BOT_COMMAND_INPUT_LENGTH)] }).success).toBe(false);
		});
	}
});
