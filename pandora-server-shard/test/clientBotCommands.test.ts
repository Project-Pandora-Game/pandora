import { describe, expect, it, jest } from '@jest/globals';
import type { BotId } from 'pandora-common/bots';
import type { Character } from '../src/character/character.ts';
import { ClientHandlersBotCommands } from '../src/networking/client/handlers/clientBotCommands.ts';
import type { ClientConnection } from '../src/networking/connection_client.ts';

describe('bot command forwarding', () => {

	it('forwards parallel runs from one character without imposing bot-specific quotas', async () => {
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
		const second = ClientHandlersBotCommands.botCommandRun(request, secondConnection);
		expect(awaitResponse).toHaveBeenCalledTimes(2);
		finish({ result: 'ok' });
		await expect(first).resolves.toEqual({ result: 'ok' });
		await expect(second).resolves.toEqual({ result: 'ok' });
		await expect(ClientHandlersBotCommands.botCommandRun(request, secondConnection)).resolves.toEqual({ result: 'ok' });
		expect(awaitResponse).toHaveBeenCalledTimes(3);
	});

	it('reports failed bot round trips', async () => {
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
