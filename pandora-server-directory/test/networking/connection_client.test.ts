import { IClientDirectory, IDirectoryClient, MockConnection, MockServerSocket } from 'pandora-common';
import { ClientConnection } from '../../src/networking/connection_client';
import { ConnectionManagerClient } from '../../src/networking/manager_client';
import { TestMockAccount, TestMockCharacter, TestMockDb } from '../utils';

describe('ClientConnection', () => {
	let connection: MockConnection<IClientDirectory, IDirectoryClient>;
	let server: MockServerSocket<IDirectoryClient>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let connectionOnMessage: jest.Mock<any, any>;

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
		}).toThrowError('Invalid operation');
	});

	describe('Receiving messages', () => {
		it('Passes message without callback to manager message handler', () => {
			const onMessageSpy = jest.spyOn(ConnectionManagerClient, 'onMessage');

			const client = new ClientConnection(server, connection.connect(), {});

			connection.sendMessage('logout', {});

			expect(onMessageSpy).toHaveBeenCalledTimes(1);
			expect(onMessageSpy).toHaveBeenNthCalledWith(1, 'logout', {}, undefined, client);
		});

		it('Passes message with callback to manager message handler', async () => {
			const onMessageSpy = jest.spyOn(ConnectionManagerClient, 'onMessage');

			const client = new ClientConnection(server, connection.connect(), {});

			await connection.awaitResponse('shardInfo', {});

			expect(onMessageSpy).toHaveBeenCalledTimes(1);
			expect(onMessageSpy).toHaveBeenNthCalledWith(1, 'shardInfo', expect.any(Object), expect.any(Function), client);
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
			client.setAccount(account);
			expect(client.account).toBe(account);
			expect(account.associatedConnections).toContain(client);
			expect(client.isLoggedIn()).toBe(true);

			// Remove
			client.setAccount(null);
			expect(client.account).toBe(null);
			expect(account.associatedConnections).not.toContain(client);
			expect(client.isLoggedIn()).toBe(false);
		});

		it('Swaps accounts', async () => {
			const account1 = await TestMockAccount();
			const account2 = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});

			// Set first
			client.setAccount(account1);
			expect(client.account).toBe(account1);
			expect(account1.associatedConnections).toContain(client);
			expect(account2.associatedConnections).not.toContain(client);

			// Swap to second
			client.setAccount(account2);
			expect(client.account).toBe(account2);
			expect(account1.associatedConnections).not.toContain(client);
			expect(account2.associatedConnections).toContain(client);
		});

		it('Removes account after disconnect', async () => {
			const account = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});

			// Set
			client.setAccount(account);

			// Disconnect
			connection.disconnect();

			expect(client.account).toBe(null);
			expect(account.associatedConnections).not.toContain(client);
		});
	});

	describe('Character management', () => {
		it('Starts with empty character', () => {
			const client = new ClientConnection(server, connection.connect(), {});
			expect(client.character).toBe(null);
		});

		it('Sets and removes character and associated connection', async () => {
			const account = await TestMockAccount();
			const character = await TestMockCharacter(account);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account);

			// Set
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(character.assignedConnection).toBe(client);

			// Remove
			client.setCharacter(null);
			expect(client.character).toBe(null);
			expect(character.assignedConnection).toBe(null);

			// Cleanup
			await account.deleteCharacter(character.id);
		});

		it('Swaps characters', async () => {
			const account = await TestMockAccount();
			const character1 = await TestMockCharacter(account);
			const character2 = await TestMockCharacter(account);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account);

			// Set first
			client.setCharacter(character1);
			expect(client.character).toBe(character1);
			expect(character1.assignedConnection).toBe(client);
			expect(character2.assignedConnection).toBe(null);

			// Swap to second
			client.setCharacter(character2);
			expect(client.character).toBe(character2);
			expect(character1.assignedConnection).toBe(null);
			expect(character2.assignedConnection).toBe(client);

			// Cleanup
			client.setCharacter(null);
			await account.deleteCharacter(character1.id);
			await account.deleteCharacter(character2.id);
		});

		it('Takes character over', async () => {
			const account = await TestMockAccount();
			const character = await TestMockCharacter(account);
			const client = new ClientConnection(server, connection.connect(), {});
			const connection2 = new MockConnection<IClientDirectory, IDirectoryClient>({ onMessage: connectionOnMessage });
			const client2 = new ClientConnection(server, connection2.connect(), {});
			client.setAccount(account);
			client2.setAccount(account);
			connectionOnMessage.mockClear();

			// Set to first connection
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(client2.character).toBe(null);
			expect(character.assignedConnection).toBe(client);
			expect(connectionOnMessage).not.toHaveBeenCalled();

			// Set to second connection
			client2.setCharacter(character);
			expect(client.character).toBe(null);
			expect(client2.character).toBe(character);
			expect(character.assignedConnection).toBe(client2);

			// Also notifies other client that character was taken away
			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: account.getAccountInfo(),
				character: null,
			}, undefined, connection);

			// Cleanup
			client2.setCharacter(null);
			await account.deleteCharacter(character.id);
		});

		it('Removes character after disconnect', async () => {
			const account = await TestMockAccount();
			const character = await TestMockCharacter(account);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account);

			// Set
			client.setCharacter(character);
			expect(client.character).toBe(character);
			expect(character.assignedConnection).toBe(client);

			// Disconnect
			connection.disconnect();

			expect(client.character).toBe(null);
			expect(character.assignedConnection).toBe(null);
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
			}, undefined, expect.anything());
		});

		it('Sends state message with account', async () => {
			const account = await TestMockAccount();
			const client = new ClientConnection(server, connection.connect(), {});
			connectionOnMessage.mockClear();

			client.setAccount(account);

			client.sendConnectionStateUpdate();

			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: account.getAccountInfo(),
				character: null,
			}, undefined, expect.anything());
		});

		it('Sends state message with character', async () => {
			const account = await TestMockAccount();
			const character = await TestMockCharacter(account);
			const client = new ClientConnection(server, connection.connect(), {});
			client.setAccount(account);
			connectionOnMessage.mockClear();

			client.setCharacter(character);
			client.sendConnectionStateUpdate();

			expect(connectionOnMessage).toHaveBeenCalledTimes(1);
			expect(connectionOnMessage).toHaveBeenNthCalledWith(1, 'connectionState', {
				account: account.getAccountInfo(),
				character: character.getShardConnectionInfo(), // Note: is actually null because of no shard
			}, undefined, expect.anything());

			// Cleanup
			client.setCharacter(null);
			await account.deleteCharacter(character.id);
		});
	});
});
