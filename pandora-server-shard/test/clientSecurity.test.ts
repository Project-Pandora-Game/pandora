import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { CharacterId } from 'pandora-common';
import type { Character } from '../src/character/character.ts';
import { CharacterManager } from '../src/character/characterManager.ts';
import type { ClientConnection } from '../src/networking/connection_client.ts';
import { ConnectionManagerClient } from '../src/networking/manager_client.ts';

afterEach(() => {
	jest.restoreAllMocks();
});

describe('Shard client authorization', () => {
	it('rejects a secret revoked after the initial transport authorization, before loading private data', () => {
		const character = { isValid: true, connectSecret: 'old-secret' };
		jest.spyOn(CharacterManager, 'getCharacter').mockReturnValue(character as Character);
		expect(ConnectionManagerClient.isAuthorized('c1', 'old-secret')).toBe(true);
		character.connectSecret = 'new-secret';

		const abortConnection = jest.fn();
		const loadCharacter = jest.fn();
		const sendLoadMessage = jest.fn();
		const connection = {
			headers: { authorization: 'c1 old-secret' },
			abortConnection,
			loadCharacter,
			sendLoadMessage,
		} as unknown as ClientConnection;
		ConnectionManagerClient.onConnect(connection);

		expect(abortConnection).toHaveBeenCalledTimes(1);
		expect(loadCharacter).not.toHaveBeenCalled();
		expect(sendLoadMessage).not.toHaveBeenCalled();
	});

	it('loads a character when the secret is still current', () => {
		const sendAllPendingMessages = jest.fn();
		const character = { isValid: true, connectSecret: 'current-secret', sendAllPendingMessages } as unknown as Character;
		jest.spyOn(CharacterManager, 'getCharacter').mockReturnValue(character);
		const loadCharacter = jest.fn((id: CharacterId) => id === 'c1');
		const sendLoadMessage = jest.fn();
		const connection = {
			headers: { authorization: 'c1 current-secret' },
			character,
			loadCharacter,
			sendLoadMessage,
		} as unknown as ClientConnection;

		ConnectionManagerClient.onConnect(connection);
		expect(loadCharacter).toHaveBeenCalledWith('c1');
		expect(sendLoadMessage).toHaveBeenCalledTimes(1);
		expect(sendAllPendingMessages).toHaveBeenCalledTimes(1);
		ConnectionManagerClient.onDisconnect(connection);
	});
});
