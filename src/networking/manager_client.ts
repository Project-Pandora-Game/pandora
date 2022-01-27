import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { IsObject, IDirectoryClientConnectionStateUpdate, MessageHandler, IClientDirectoryBase, IClientDirectoryMessageHandler, IClientDirectoryUnconfirmedArgument, IClientDirectoryPromiseResult } from 'pandora-common';
import { accountManager } from '../account/accountManager';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export default new class ConnectionManagerClient {
	private connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientDirectoryMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientDirectoryBase, IConnectionClient>({
			login: this.handleLogin.bind(this),
		}, {});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient, auth: unknown): void {
		this.connectedClients.add(connection);
		// Check if connect-time authentication is valid and process it
		if (IsObject(auth) && typeof auth.username === 'string' && typeof auth.token === 'string') {
			this.handleAuth(connection, auth.username, auth.token)
				.catch((error) => {
					logger.error(`Error processing connect auth from ${connection.id}`, error);
				});
		}
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: IConnectionClient): void {
		if (!this.connectedClients.has(connection)) {
			logger.fatal('Asserting failed: client disconnect while not in connectedClients', connection);
			return;
		}
		this.connectedClients.delete(connection);
		connection.setAccount(null);
	}

	/**
	 * Handle `login` message from client
	 * @param connection - The connection that this message comes from
	 * @param message - Contets of the message
	 * @returns Result of the login
	 */
	private async handleLogin(message: IClientDirectoryUnconfirmedArgument['login'], connection: IConnectionClient): IClientDirectoryPromiseResult['login'] {
		// Verify content of the message
		if (typeof message.username !== 'string' ||
			typeof message.password !== 'string'
		) {
			logger.warning(`Bad message from ${connection.id} content for message 'login'`, message);
			return Promise.reject(false);
		}

		// Find account by username
		const account = await accountManager.loadAccountByUsername(message.username);
		// Verify the password
		if (!account || !await account.verifyPassword(message.password)) {
			return {
				result: 'unknownCredentials',
				update: MakeClientStateUpdate(connection),
			};
		}
		// Generate new auth token for new login
		const token = await account.generateNewLoginToken();
		// Set the account for the connection and return result
		logger.info(`${connection.id} logged in as ${account.data.username}`);
		connection.setAccount(account);
		return {
			result: 'ok',
			token,
			update: MakeClientStateUpdate(connection),
		};
	}

	/**
	 * Handle connect-time request for authentication using token
	 * @param connection - The connection that this message comes from
	 * @param username - Username from auth request
	 * @param token - Token secret from auth request
	 */
	private async handleAuth(connection: IConnectionClient, username: string, token: string): Promise<void> {
		// Find account by username
		const account = await accountManager.loadAccountByUsername(username);
		// Verify the token validity
		if (account && account.verifyLoginToken(token)) {
			logger.info(`${connection.id} logged in as ${account.data.username} using token`);
			connection.setAccount(account);
		}
		// Make connection aware of the result
		connection.sendMessage('connectionState', MakeClientStateUpdate(connection));
	}
};

/** Build `connectionState` update message for connection */
function MakeClientStateUpdate(connection: IConnectionClient): IDirectoryClientConnectionStateUpdate {
	return {
		account: connection.account ? connection.account.data.username : null,
	};
}
