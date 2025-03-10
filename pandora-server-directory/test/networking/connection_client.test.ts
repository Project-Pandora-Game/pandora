import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { nanoid } from 'nanoid';
import { Assert, IClientDirectory, IDirectoryClient, MockConnection, MockServerSocket } from 'pandora-common';
import { AccountToken, AccountTokenReason } from '../../src/account/accountSecure.ts';
import { ClientConnection } from '../../src/networking/connection_client.ts';
import { ConnectionManagerClient } from '../../src/networking/manager_client.ts';
import { TestMockAccount, TestMockCharacter, TestMockDb } from '../utils.ts';

describe('ClientConnection', () => {
	let connection: MockConnection<IClientDirectory, IDirectoryClient>;
	let server: MockServerSocket<IDirectoryClient>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let connectionOnMessage: jest.Mock<any>;
	const token = new AccountToken({ value: 'test', reason: AccountTokenReason.LOGIN, expires: Date.now() + 3600_000 });

	beforeAll(async () => {
		await TestMockDb();
	});

	beforeEach(() => {
		connectionOnMessage = jest.fn(() => {
			return Promise.resolve(true);
		});
		server = new MockServerSocket();
		connection = new MockConnection({ onMessage: connectionOnMessage });
	});
	afterEach(() => {
		connection.disconnect();
	});

	it('Calls manager onConnect after creation', () => {
		const onConnectSpy = jest.spyOn(ConnectionManagerClient, 'onConnect');
		// Check, that this exact data is passed
		const authData = {};

		const client = new ClientConnection(server, connection.connect(), authData);

		expect(onConnectSpy).toHaveBeenCalledTimes(1);
		expect(onConnectSpy).toHaveBeenNthCalledWith(1, client, authData);
	});

	it('Calls manager onDisconnect after connection disconnects', () => {
		const onDisconnectSpy = jest.spyOn(ConnectionManagerClient, 'onDisconnect');

		const client = new ClientConnection(server, connection.connect(), {});

		expect(onDisconnectSpy).not.toHaveBeenCalled();
		connection.disconnect();
		expect(onDisconnectSpy).toHaveBeenCalledTimes(1);
		expect(onDisconnectSpy).toHaveBeenNthCalledWith(1, client);
	});

	it('Refuses awaitResponse request', () => {
		const client = new ClientConnection(server, connection.connect(), {});

		expect(() => {
			return client.awaitResponse('test', {});
		}).toThrow('Invalid operation');
	});

	describe('Receiving messages', () => {
		it('Passes message to manager message handler', async () => {
			const onMessageSpy = jest.spyOn(ConnectionManagerClient, 'onMessage');

			const client = new ClientConnection(server, connection.connect(), {});

			connection.sendMessage('logout', { type: 'self' });
			await connection.awaitResponse('shardInfo', {});

			expect(onMessageSpy).toHaveBeenCalledTimes(2);
			expect(onMessageSpy).toHaveBeenNthCalledWith(1, 'logout', { type: 'self' }, client);
			expect(onMessageSpy).toHaveBeenNthCalledWith(2, 'shardInfo', expect.any(Object), client);
		});
	});

	describe('Account management', () => {
		it('Starts with empty account', () => {
			const client = new ClientConnection(server, connection.connect(), {});
			expect(client.account).toBe(null);
		});

		it('Sets and removes account and associated connections', async () => {
			const account = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});

			// Set
			client.setAccount(account, token);
			expect(client.account).toBe(account);
			expect(account.associatedConnections.clients).toContain(client);
			expect(client.isLoggedIn()).toBe(true);

			// Remove
			client.setAccount(null);
			expect(client.account).toBe(null);
			expect(account.associatedConnections.clients).not.toContain(client);
			expect(client.isLoggedIn()).toBe(false);
		});

		it('Swaps accounts', async () => {
			const account1 = await TestMockAccount();
			const account2 = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});

			// Set first
			client.setAccount(account1, token);
			expect(client.account).toBe(account1);
			expect(account1.associatedConnections.clients).toContain(client);
			expect(account2.associatedConnections.clients).not.toContain(client);

			// Swap to second
			client.setAccount(account2, token);
			expect(client.account).toBe(account2);
			expect(account1.associatedConnections.clients).not.toContain(client);
			expect(account2.associatedConnections.clients).toContain(client);
		});

		it('Removes account after disconnect', async () => {
			const account = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});

			// Set
			client.setAccount(account, token);

			// Disconnect
			connection.disconnect();

			expect(client.account).toBe(null);
			expect(account.associatedConnections.clients).not.toContain(client);
		});
	});

	describe('Character management', () => {
		it('Starts with empty character', () => {
			const client = new ClientConnection(server, connection.connect(), {});
			expect(client.character).toBe(null);
		});

		it('Sets and removes character and associated connection', async () => {
			const password = nanoid();
			const account = await TestMockAccount({ password });
			const characterInfo = await TestMockCharacter(account);
			const character = await characterInfo.requestLoad();
			Assert(character != null);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account, token);

			// Set
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(character.assignedClient).toBe(client);

			// Remove
			client.setCharacter(null);
			expect(client.character).toBe(null);
			expect(character.assignedClient).toBe(null);

			// Cleanup
			await account.deleteCharacter(characterInfo.id, password);
		});

		it('Swaps characters', async () => {
			const password = nanoid();
			const account = await TestMockAccount({ password });
			const characterInfo1 = await TestMockCharacter(account);
			const character1 = await characterInfo1.requestLoad();
			Assert(character1 != null);
			const characterInfo2 = await TestMockCharacter(account);
			const character2 = await characterInfo2.requestLoad();
			Assert(character2 != null);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account, token);

			// Set first
			client.setCharacter(character1);
			expect(client.character).toBe(character1);
			expect(character1.assignedClient).toBe(client);
			expect(character2.assignedClient).toBe(null);

			// Swap to second
			client.setCharacter(character2);
			expect(client.character).toBe(character2);
			expect(character1.assignedClient).toBe(null);
			expect(character2.assignedClient).toBe(client);

			// Cleanup
			client.setCharacter(null);
			await account.deleteCharacter(characterInfo1.id, password);
			await account.deleteCharacter(characterInfo2.id, password);
		});

		it('Fails when character is in use', async () => {
			const password = nanoid();
			const account = await TestMockAccount({ password });
			const characterInfo = await TestMockCharacter(account);
			const character = await characterInfo.requestLoad();
			Assert(character != null);
			const client = new ClientConnection(server, connection.connect(), {});
			const connection2 = new MockConnection<IClientDirectory, IDirectoryClient>({ onMessage: connectionOnMessage });
			const client2 = new ClientConnection(server, connection2.connect(), {});
			client.setAccount(account, token);
			client2.setAccount(account, token);
			connectionOnMessage.mockClear();

			// Set to first connection
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(client2.character).toBe(null);
			expect(character.assignedClient).toBe(client);
			expect(connectionOnMessage).not.toHaveBeenCalled();

			// Fails to set the second connection
			expect(() => {
				client2.setCharacter(character);
			}).toThrow();
			expect(client.character).toBe(character);
			expect(client2.character).toBe(null);
			expect(character.assignedClient).toBe(client);

			// Cleanup
			client.setCharacter(null);
			await account.deleteCharacter(characterInfo.id, password);
		});

		it('Removes character after disconnect', async () => {
			const account = await TestMockAccount();
			const characterInfo = await TestMockCharacter(account);
			const character = await characterInfo.requestLoad();
			Assert(character != null);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account, token);

			// Set
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(character.assignedClient).toBe(client);

			// Disconnect
			connection.disconnect();

			expect(client.character).toBe(null);
			expect(character.assignedClient).toBe(null);
		});
	});

	describe('sendConnectionStateUpdate()', () => {
		it('Sends empty state message', () => {
			const client = new ClientConnection(server, connection.connect(), {});
			connectionOnMessage.mockClear();

			client.sendConnectionStateUpdate();

			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: null,
				character: null,
			}, expect.anything());
		});

		it('Sends state message with account', async () => {
			const account = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});
			connectionOnMessage.mockClear();

			client.setAccount(account, token);

			client.sendConnectionStateUpdate();

			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: account.getAccountInfo(),
				character: null,
			}, expect.anything());
		});

		it('Sends state message with character', async () => {
			const password = nanoid();
			const account = await TestMockAccount({ password });
			const characterInfo = await TestMockCharacter(account);
			const character = await characterInfo.requestLoad();
			Assert(character != null);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account, token);
			connectionOnMessage.mockClear();

			client.setCharacter(character);
			client.sendConnectionStateUpdate();

			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: account.getAccountInfo(),
				character: character.getShardConnectionInfo(), // Note: is actually null because of no shard
			}, expect.anything());

			// Cleanup
			client.setCharacter(null);
			await account.deleteCharacter(characterInfo.id, password);
		});
	});
});
