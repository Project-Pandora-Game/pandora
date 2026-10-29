import { describe, expect, it, jest } from '@jest/globals';
import type { BotId } from 'pandora-common/bots';
import type { Character } from '../src/character/character.ts';
import { BotCommandRequestLimiter } from '../src/networking/client/handlers/botCommandRequestLimiter.ts';
import { ClientHandlersBotCommands } from '../src/networking/client/handlers/clientBotCommands.ts';
import type { ClientConnection } from '../src/networking/connection_client.ts';

describe('bot command budget', () => {
	it('bounds requests by character and refills over time', () => {
		const limiter = new BotCommandRequestLimiter();
		const character = {};
		for (let i = 0; i < 32; i++) {
			const release = limiter.acquire(character, 'structure', 1_000);
			expect(release).not.toBeNull();
			release?.();
		}
		expect(limiter.acquire(character, 'structure', 1_000)).toBeNull();
		expect(limiter.acquire({}, 'structure', 1_000)).not.toBeNull();
		expect(limiter.acquire(character, 'structure', 2_000)).not.toBeNull();
	});

	it('does not forward parallel runs from one character and releases on completion', async () => {
		let finish!: (result: { result: 'ok'; }) => void;
		const pending = new Promise<{ result: 'ok'; }>((resolve) => {
			finish = resolve;
		});
		const awaitResponse = jest.fn(() => pending);
		const bot: BotId = `bot:${'a'.repeat(32)}`;
		const character = { id: 'c1', loadedSpace: { id: 'space', bot: { id: bot, connection: { awaitResponse } } } } as unknown as Character;
		const firstConnection = { character } as unknown as ClientConnection;
		const secondConnection = { character } as unknown as ClientConnection;
		const request = { bot, command: 'test', args: [] };
		const first = ClientHandlersBotCommands.botCommandRun(request, firstConnection);
		await expect(ClientHandlersBotCommands.botCommandRun(request, secondConnection)).resolves.toEqual({ result: 'rateLimited' });
		expect(awaitResponse).toHaveBeenCalledTimes(1);
		finish({ result: 'ok' });
		await expect(first).resolves.toEqual({ result: 'ok' });
		await expect(ClientHandlersBotCommands.botCommandRun(request, secondConnection)).resolves.toEqual({ result: 'ok' });
		expect(awaitResponse).toHaveBeenCalledTimes(2);
	});

	it('releases a failed bot round trip', async () => {
		const awaitResponse = jest.fn(() => Promise.reject(new Error('bot disconnected')));
		const bot: BotId = `bot:${'b'.repeat(32)}`;
		const character = { id: 'c2', loadedSpace: { id: 'space', bot: { id: bot, connection: { awaitResponse } } } } as unknown as Character;
		const connection = { character } as unknown as ClientConnection;
		const request = { bot, command: 'test', args: [] };
		await expect(ClientHandlersBotCommands.botCommandRun(request, connection)).resolves.toEqual({ result: 'botError' });
		await expect(ClientHandlersBotCommands.botCommandRun(request, connection)).resolves.toEqual({ result: 'botError' });
		expect(awaitResponse).toHaveBeenCalledTimes(2);
	});
});
