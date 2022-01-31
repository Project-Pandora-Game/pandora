import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { IsObject, IDirectoryClientConnectionStateUpdate, MessageHandler, IClientDirectoryBase, IClientDirectoryMessageHandler, IClientDirectoryUnconfirmedArgument, IClientDirectoryPromiseResult, IsUsername, IsEmail, CreateStringValidator } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { AccountSecurePasswordReset } from '../account/accountSecure';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export default new class ConnectionManagerClient {
	private connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientDirectoryMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientDirectoryBase, IConnectionClient>({
			login: this.handleLogin.bind(this),
			register: this.handleRegister.bind(this),
			verifyEmail: this.handleVerifyEmail.bind(this),
			passwordReset: this.handlePasswordReset.bind(this),
			passwordResetConfirm: this.handlePasswordResetConfirm.bind(this),
			passwordChange: this.handlerPasswordChange.bind(this),
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
	 * @param message - Content of the message
	 * @param connection - The connection that this message comes from
	 * @returns Result of the login
	 */
	private async handleLogin({ username, passwordSha512 }: IClientDirectoryUnconfirmedArgument['login'], connection: IConnectionClient): IClientDirectoryPromiseResult['login'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || !IsPasswordSha512(passwordSha512)) {
			return RejectWithLog(connection, 'login', { username, passwordSha512 });
		}

		// Find account by username
		const account = await accountManager.loadAccountByUsername(username);
		// Verify the password
		if (!account || !await account.secure.verifyPassword(passwordSha512)) {
			return {
				result: 'unknownCredentials',
				update: MakeClientStateUpdate(connection),
			};
		}
		// Generate new auth token for new login
		const token = await account.secure.generateNewLoginToken();
		// Set the account for the connection and return result
		logger.info(`${connection.id} logged in as ${account.data.username}`);
		connection.setAccount(account);
		return {
			result: 'ok',
			token,
			update: MakeClientStateUpdate(connection),
		};
	}

	private async handleRegister({ username, email, passwordSha512 }: IClientDirectoryUnconfirmedArgument['register'], connection: IConnectionClient): IClientDirectoryPromiseResult['register'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || !IsEmail(email) || !IsPasswordSha512(passwordSha512))
			return RejectWithLog(connection, 'register', { username, email, passwordSha512 });

		const result = await accountManager.createAccount(username, passwordSha512, email);
		if (typeof result === 'string')
			return { result };

		return { result: 'ok' };
	}

	private async handleVerifyEmail({ username, token }: IClientDirectoryUnconfirmedArgument['verifyEmail'], connection: IConnectionClient): IClientDirectoryPromiseResult['verifyEmail'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || typeof token !== 'string')
			return RejectWithLog(connection, 'verifyEmail', { username, token });

		const account = await accountManager.loadAccountByUsername(username);
		if (!account || account.isActivated())
			return { result: 'unknownCredentials' };

		if (!await account.secure.activateAccount(token))
			return { result: 'invalidToken' };

		return { result: 'ok' };
	}

	private async handlePasswordReset({ email }: IClientDirectoryUnconfirmedArgument['passwordReset'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordReset'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsEmail(email))
			return RejectWithLog(connection, 'passwordReset', { email });

		await AccountSecurePasswordReset(email);

		return { result: 'maybeSent' };
	}

	private async handlePasswordResetConfirm({ username, token, passwordSha512 }: IClientDirectoryUnconfirmedArgument['passwordResetConfirm'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordResetConfirm'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || typeof token !== 'string' || !IsPasswordSha512(passwordSha512))
			return RejectWithLog(connection, 'passwordResetConfirm', { username, token, passwordSha512 });

		const account = await accountManager.loadAccountByUsername(username);
		if (!account?.isActivated() || !await account.secure.finishPasswordReset(token, passwordSha512))
			return { result: 'unknownCredentials' };

		return { result: 'ok' };
	}

	private async handlerPasswordChange({ passwordSha512Old, passwordSha512New }: IClientDirectoryUnconfirmedArgument['passwordChange'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordChange'] {
		// Verify content of the message
		if (!connection.isLoggedIn() || !IsPasswordSha512(passwordSha512Old) || !IsPasswordSha512(passwordSha512New))
			return RejectWithLog(connection, 'passwordChange', { passwordSha512Old, passwordSha512New });

		if (!connection.account || !await connection.account.secure.changePassword(passwordSha512Old, passwordSha512New))
			return { result: 'invalidPassword' };

		return { result: 'ok' };
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
		if (account && account.secure.verifyLoginToken(token)) {
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

function RejectWithLog<T extends keyof IClientDirectoryBase & string>(connection: IConnectionClient, messageType: T, message: IClientDirectoryUnconfirmedArgument[T]): Promise<never> {
	logger.warning(`Bad message from ${connection.id} content for message '${messageType}' `, message);
	return Promise.reject(false);
}

/** Checks if the given password is a base64 encode SHA-512 hash */
const IsPasswordSha512 = CreateStringValidator({
	regex: /^[a-zA-Z0-9+/]{86}==$/,
});
