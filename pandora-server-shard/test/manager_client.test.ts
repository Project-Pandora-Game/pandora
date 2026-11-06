import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Character } from '../src/character/character.ts';
import type { ClientConnection } from '../src/networking/connection_client.ts';
import { ConnectionManagerClient } from '../src/networking/manager_client.ts';
import { Space } from '../src/spaces/space.ts';

afterEach(() => {
	jest.restoreAllMocks();
});

describe('Shard request handling', () => {
	it('deduplicates targets and does not re-send unchanged status', () => {
		const sendMessage = jest.fn();
		const target = { connection: { sendMessage } };
		const space = {
			status: new Map(),
			getCharacterById: () => target,
			sendMessage: jest.fn(),
		} as unknown as Space;
		const character = { id: 'c1' } as unknown as Character;
		Space.prototype.updateStatus.call(space, character, 'typing', ['c2', 'c3', 'c2']);
		Space.prototype.updateStatus.call(space, character, 'typing', ['c3', 'c2']);
		expect(sendMessage).toHaveBeenCalledTimes(2);
	});

	it('does not force full reloads after failed game actions', async () => {
		let now = 1000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		const sendLoadMessage = jest.fn();
		const state = { assetManager: {}, produceCharacterState: () => null };
		const space = { currentState: state, getCharacterById: jest.fn() };
		const restrictionManager = { appearance: { id: 'c1' } };
		const context = { player: { id: 'c1' }, getCharacter: () => ({ getRestrictionManager: () => restrictionManager }) };
		const character = { getOrLoadSpace: () => space, getAppearanceActionContext: () => context } as unknown as Character;
		const connection = { character, sendLoadMessage } as unknown as ClientConnection;

		for (let i = 0; i < 9; i++) {
			expect(await ConnectionManagerClient.onMessage('gameLogicAction', { operation: 'complete' }, connection)).toMatchObject({ result: 'failure' });
		}
		expect(sendLoadMessage).not.toHaveBeenCalled();
		now += 2_000;
		await ConnectionManagerClient.onMessage('gameLogicAction', { operation: 'complete' }, connection);
		expect(sendLoadMessage).not.toHaveBeenCalled();
	});
});
