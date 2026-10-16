import { describe, expect, it } from '@jest/globals';
import { ClientShardSchema } from '../../src/networking/api/shard_client/client_shard.ts';

const request = { bot: `bot:${'a'.repeat(32)}`, command: 'test', args: ['argument'] };

describe('bot command client requests', () => {
	for (const kind of ['botCommandRun', 'botCommandGetStructurePart'] as const) {
		it(`${kind} rejects oversized and excessive arguments`, () => {
			const schema = ClientShardSchema[kind].request;
			expect(schema.safeParse(request).success).toBe(true);
			expect(schema.safeParse({ ...request, command: 'x'.repeat(129) }).success).toBe(false);
			expect(schema.safeParse({ ...request, args: Array(33).fill('x') }).success).toBe(false);
			expect(schema.safeParse({ ...request, args: ['x'.repeat(25_001)] }).success).toBe(false);
		});
	}
});
