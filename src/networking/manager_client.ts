import { GetLogger } from 'pandora-common/dist/logging';
import { IConnectionClient } from './common';
import { IsObject, IDirectoryAccountInfo, MessageHandler, IClientDirectoryBase, IClientDirectoryMessageHandler, IClientDirectoryUnconfirmedArgument, IClientDirectoryPromiseResult, IsUsername, IsEmail, CreateStringValidator, IsSimpleToken, CreateObjectValidator, CreateBase64Validator, IsCharacterId, BadMessageError, IClientDirectoryNormalResult, IsString } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../account/accountProcedures';
import { Account } from '../account/account';
import ConnectionManagerShard from './manager_shard';
import { CHARACTER_LIMIT_NORMAL } from '../config';

import { nanoid } from 'nanoid';

const logger = GetLogger('ConnectionManager-Client');

/** Class that stores all currently connected clients */
export default new class ConnectionManagerClient {
	private connectedClients: Set<IConnectionClient> = new Set();

	readonly messageHandler: IClientDirectoryMessageHandler<IConnectionClient>;

	constructor() {
		this.messageHandler = new MessageHandler<IClientDirectoryBase, IConnectionClient>({
			login: this.handleLogin.bind(this),
			register: this.handleRegister.bind(this),
			resendVerificationEmail: this.handleResendVerificationEmail.bind(this),
			passwordReset: this.handlePasswordReset.bind(this),
			passwordResetConfirm: this.handlePasswordResetConfirm.bind(this),
			passwordChange: this.handlePasswordChange.bind(this),

			listCharacters: this.handleListCharacters.bind(this),
			createCharacter: this.handleCreateCharacter.bind(this),
			updateCharacter: this.handleUpdateCharacter.bind(this),
			deleteCharacter: this.handleDeleteCharacter.bind(this),
			connectCharacter: this.handleConnectCharacter.bind(this),
		}, {
			logout: this.handleLogout.bind(this),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient, auth: unknown): void {
		this.connectedClients.add(connection);
		// Check if connect-time authentication is valid and process it
		if (IsObject(auth) && IsUsername(auth.username) && IsString(auth.value)) {
			this.handleAuth(connection, auth.username, auth.value)
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
	private async handleLogin({ username, passwordSha512, verificationToken }: IClientDirectoryUnconfirmedArgument['login'], connection: IConnectionClient): IClientDirectoryPromiseResult['login'] {
		// Verify content of the message
		if (connection.isLoggedIn() ||
			!IsUsername(username) ||
			!IsPasswordSha512(passwordSha512) ||
			(verificationToken !== undefined && !IsSimpleToken(verificationToken))
		) {
			throw new BadMessageError();
		}

		// Find account by username
		const account = await accountManager.loadAccountByUsername(username);
		// Verify the password
		if (!account || !await account.secure.verifyPassword(passwordSha512)) {
			return { result: 'unknownCredentials' };
		}
		// Verify account is activated or activate it
		if (!account.secure.isActivated()) {
			if (verificationToken === undefined) {
				return { result: 'verificationRequired' };
			}
			if (!await account.secure.activateAccount(verificationToken)) {
				return { result: 'invalidToken' };
			}
		}
		// Generate new auth token for new login
		const token = await account.secure.generateNewLoginToken();
		// Set the account for the connection and return result
		logger.info(`${connection.id} logged in as ${account.data.username}`);
		connection.setAccount(account);
		return {
			result: 'ok',
			token: { value: token.value, expires: token.expires },
			account: GetAccountInfo(account),
		};
	}

	private async handleLogout({ invalidateToken }: IClientDirectoryUnconfirmedArgument['logout'], connection: IConnectionClient): IClientDirectoryPromiseResult['logout'] {
		// Verify content of the message
		if (!connection.isLoggedIn() ||
			(invalidateToken !== undefined && typeof invalidateToken !== 'string')
		) {
			throw new BadMessageError();
		}

		const account = connection.account;

		connection.setAccount(null);
		logger.info(`${connection.id} logged out`);

		if (invalidateToken) {
			await account.secure.invalidateLoginToken(invalidateToken);
		}
	}

	private async handleRegister({ username, email, passwordSha512 }: IClientDirectoryUnconfirmedArgument['register'], connection: IConnectionClient): IClientDirectoryPromiseResult['register'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || !IsEmail(email) || !IsPasswordSha512(passwordSha512))
			throw new BadMessageError();

		const result = await accountManager.createAccount(username, passwordSha512, email);
		if (typeof result === 'string')
			return { result };

		return { result: 'ok' };
	}

	private async handleResendVerificationEmail({ email }: IClientDirectoryUnconfirmedArgument['resendVerificationEmail'], connection: IConnectionClient): IClientDirectoryPromiseResult['resendVerificationEmail'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsEmail(email))
			throw new BadMessageError();

		await AccountProcedureResendVerifyEmail(email);

		return { result: 'maybeSent' };
	}

	private async handlePasswordReset({ email }: IClientDirectoryUnconfirmedArgument['passwordReset'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordReset'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsEmail(email))
			throw new BadMessageError();

		await AccountProcedurePasswordReset(email);

		return { result: 'maybeSent' };
	}

	private async handlePasswordResetConfirm({ username, token, passwordSha512 }: IClientDirectoryUnconfirmedArgument['passwordResetConfirm'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordResetConfirm'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || !IsSimpleToken(token) || !IsPasswordSha512(passwordSha512))
			throw new BadMessageError();

		const account = await accountManager.loadAccountByUsername(username);
		if (!await account?.secure.finishPasswordReset(token, passwordSha512))
			return { result: 'unknownCredentials' };

		return { result: 'ok' };
	}

	private async handlePasswordChange({ passwordSha512Old, passwordSha512New }: IClientDirectoryUnconfirmedArgument['passwordChange'], connection: IConnectionClient): IClientDirectoryPromiseResult['passwordChange'] {
		// Verify content of the message
		if (!connection.isLoggedIn() || !IsPasswordSha512(passwordSha512Old) || !IsPasswordSha512(passwordSha512New))
			throw new BadMessageError();

		if (!await connection.account.secure.changePassword(passwordSha512Old, passwordSha512New))
			return { result: 'invalidPassword' };

		return { result: 'ok' };
	}

	private handleListCharacters(_: IClientDirectoryUnconfirmedArgument['listCharacters'], connection: IConnectionClient): IClientDirectoryNormalResult['listCharacters'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		return {
			characters: connection.account.listCharacters(),
			limit: CHARACTER_LIMIT_NORMAL,
		};
	}

	private async handleCreateCharacter(_: IClientDirectoryUnconfirmedArgument['createCharacter'], connection: IConnectionClient): IClientDirectoryPromiseResult['createCharacter'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const shard = ConnectionManagerShard.getRandomShard();
		if (!shard)
			return { result: 'noShardFound' };

		const char = await connection.account.createCharacter();
		if (!char)
			return { result: 'maxCharactersReached' };

		const secret = nanoid();

		shard.addAccountCharacter(connection.account, char.id, char.accessId);

		const { result } = await shard.awaitResponse('prepareClient', {
			characterId: char.id,
			connectionSecret: secret,
			accessId: char.accessId,
		});

		if (result !== 'accepted') {
			logger.error(`Failed to prepare client for character ${char.id}, shard: ${shard.id}, result: `, result);
			shard.removeCharacter(char.id);
			return { result: 'noShardFound' };
		}

		return ({
			...shard.getInfo(),
			characterId: char.id,
			secret,
			result: 'ok',
		});
	}

	private async handleUpdateCharacter(arg: IClientDirectoryUnconfirmedArgument['updateCharacter'], connection: IConnectionClient): IClientDirectoryPromiseResult['updateCharacter'] {
		if (!connection.isLoggedIn() || !IsUpdateCharacter(arg) || !connection.account.hasCharacter(arg.id))
			throw new BadMessageError();

		const info = await connection.account.updateCharacter(arg);
		if (!info)
			throw new Error(`Failed to update character ${arg.id}`);

		return info;
	}

	private async handleDeleteCharacter({ id }: IClientDirectoryUnconfirmedArgument['deleteCharacter'], connection: IConnectionClient): IClientDirectoryPromiseResult['deleteCharacter'] {
		if (!connection.isLoggedIn() || !IsCharacterId(id) || !connection.account.hasCharacter(id))
			throw new BadMessageError();

		const success = await connection.account.deleteCharacter(id);
		if (!success)
			return { result: 'characterInUse' };

		return { result: 'ok' };
	}

	private async handleConnectCharacter({ id }: IClientDirectoryUnconfirmedArgument['connectCharacter'], connection: IConnectionClient): IClientDirectoryPromiseResult['connectCharacter'] {
		// TODO: move character, allow connecting to an already connected character
		if (!connection.isLoggedIn() || !IsCharacterId(id) || !connection.account.hasCharacter(id))
			throw new BadMessageError();

		const accessId = await connection.account.generateAccessId(id);
		if (!accessId) {
			logger.error(`Failed to generate accessId for character ${id}`);
			return { result: 'noShardFound' };
		}

		const shard = ConnectionManagerShard.getRandomShard();
		if (!shard)
			return { result: 'noShardFound' };

		const secret = nanoid();

		shard.addAccountCharacter(connection.account, id, accessId);

		const { result } = await shard.awaitResponse('prepareClient', {
			characterId: id,
			connectionSecret: secret,
			accessId,
		});

		if (result !== 'accepted') {
			logger.error(`Failed to prepare client for character ${id}, shard: ${shard.id}, result: `, result);
			shard.removeCharacter(id);
			return { result: 'noShardFound' };
		}

		return ({
			...shard.getInfo(),
			secret,
			result: 'ok',
		});
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

			connection.sendMessage('connectionState', {
				account: GetAccountInfo(account),
			});

			return;
		}
		// Notify the client that the token is invalid
		connection.sendMessage('connectionState', {});
	}
};

/** Build `connectionState` update message for connection */
function GetAccountInfo(account: Account): IDirectoryAccountInfo {
	return {
		id: account.data.id,
		username: account.data.username,
		created: account.data.created,
	};
}

/** Checks if the given password is a base64 encode SHA-512 hash */
const IsPasswordSha512 = CreateStringValidator({
	regex: /^[a-zA-Z0-9+/]{86}==$/,
});

// TODO: Add length check for preview

const IsUpdateCharacter = CreateObjectValidator({
	id: IsCharacterId,
	preview: CreateBase64Validator(),
}, true);
