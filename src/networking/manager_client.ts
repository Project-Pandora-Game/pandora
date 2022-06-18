import { IConnectionClient } from './common';
import { GetLogger, IsClientDirectoryAuthMessage, IsIChatRoomDirectoryConfig, IsRoomId, MessageHandler, IClientDirectoryBase, IClientDirectoryMessageHandler, IClientDirectoryUnconfirmedArgument, IClientDirectoryPromiseResult, IsUsername, IsEmail, CreateStringValidator, IsSimpleToken, CreateObjectValidator, CreateBase64Validator, IsCharacterId, BadMessageError, IClientDirectoryNormalResult, IClientDirectoryAuthMessage, IsString, IsPartialIChatRoomDirectoryConfig, IDirectoryStatus } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../account/accountProcedures';
import { BETA_KEY, CHARACTER_LIMIT_NORMAL } from '../config';
import { ShardManager } from '../shard/shardManager';
import promClient from 'prom-client';

/** Time (in ms) of how often the directory should send status updates */
export const STATUS_UPDATE_INTERVAL = 60_000;

const logger = GetLogger('ConnectionManager-Client');

const connectedClientsMetric = new promClient.Gauge({
	name: 'pandora_directory_client_connections',
	help: 'Current count of connections from clients',
	labelNames: ['messageType'],
});

const messagesMetric = new promClient.Counter({
	name: 'pandora_directory_client_messages',
	help: 'Count of received messages from clients',
	labelNames: ['messageType'],
});

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient {
	private connectedClients: Set<IConnectionClient> = new Set();

	private readonly messageHandler: IClientDirectoryMessageHandler<IConnectionClient>;

	public onMessage(messageType: string, message: Record<string, unknown>, callback: ((arg: Record<string, unknown>) => void) | undefined, connection: IConnectionClient): Promise<boolean> {
		return this.messageHandler.onMessage(messageType, message, callback, connection).then((result) => {
			// Only count valid messages
			if (result) {
				messagesMetric.inc({ messageType });
			}
			return result;
		});
	}

	/** Init the manager */
	public init(): void {
		if (this.statusUpdateInterval === undefined) {
			this.statusUpdateInterval = setInterval(this.broadcastStatusUpdate.bind(this), STATUS_UPDATE_INTERVAL).unref();
		}
	}

	public onDestroy(): void {
		if (this.statusUpdateInterval !== undefined) {
			clearInterval(this.statusUpdateInterval);
			this.statusUpdateInterval = undefined;
		}
	}

	private statusUpdateInterval: NodeJS.Timeout | undefined;
	private broadcastStatusUpdate() {
		const status = MakeStatus();
		for (const connection of this.connectedClients) {
			connection.sendMessage('serverStatus', status);
		}
	}

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

			shardInfo: this.handleShardInfo.bind(this),

			listRooms: this.handleListRooms.bind(this),
			chatRoomCreate: this.handleChatRoomCreate.bind(this),
			chatRoomEnter: this.handleChatRoomEnter.bind(this),
			chatRoomUpdate: this.handleChatRoomUpdate.bind(this),
		}, {
			logout: this.handleLogout.bind(this),
			disconnectCharacter: this.handleDisconnectCharacter.bind(this),
			chatRoomLeave: this.handleChatRoomLeave.bind(this),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: IConnectionClient, auth: unknown): void {
		this.connectedClients.add(connection);
		connectedClientsMetric.set(this.connectedClients.size);
		// Send current server status to the client
		connection.sendMessage('serverStatus', MakeStatus());
		// Check if connect-time authentication is valid and process it
		if (IsClientDirectoryAuthMessage(auth)) {
			this.handleAuth(connection, auth)
				.catch((error) => {
					logger.error(`Error processing connect auth from ${connection.id}`, error);
				});
		} else {
			// Notify the client of their new state
			connection.sendConnectionStateUpdate();
		}
	}

	/** Handle disconnecting client */
	public onDisconnect(connection: IConnectionClient): void {
		if (!this.connectedClients.has(connection)) {
			logger.fatal('Assertion failed: client disconnect while not in connectedClients', connection);
			return;
		}
		this.connectedClients.delete(connection);
		connectedClientsMetric.set(this.connectedClients.size);
		connection.setAccount(null);
		connection.setCharacter(null);
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
		logger.verbose(`${connection.id} logged in as ${account.data.username}`);
		connection.setAccount(account);
		return {
			result: 'ok',
			token: { value: token.value, expires: token.expires },
			account: account.getAccountInfo(),
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
		connection.character?.disconnect();
		connection.setCharacter(null);
		logger.verbose(`${connection.id} logged out`);

		if (invalidateToken) {
			await account.secure.invalidateLoginToken(invalidateToken);
		}
	}

	private async handleRegister({ username, email, passwordSha512, betaKey }: IClientDirectoryUnconfirmedArgument['register'], connection: IConnectionClient): IClientDirectoryPromiseResult['register'] {
		// Verify content of the message
		if (connection.isLoggedIn() || !IsUsername(username) || !IsEmail(email) || !IsPasswordSha512(passwordSha512))
			throw new BadMessageError();

		if (BETA_KEY && betaKey !== BETA_KEY)
			return { result: 'invalidBetaKey' };

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

		const char = await connection.account.createCharacter();
		if (!char)
			return { result: 'maxCharactersReached' };

		const result = await char.connect();

		if (typeof result === 'string') {
			connection.setCharacter(null);
			return { result };
		}

		connection.setCharacter(char);
		return ({
			...result,
			characterId: char.id,
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

		const char = connection.account.characters.get(id);
		if (!char) {
			throw new Error('Assertion failed');
		}

		const result = await char.connect();

		if (typeof result === 'string') {
			connection.setCharacter(null);
			return { result };
		}

		connection.setCharacter(char);
		return ({
			...result,
			result: 'ok',
		});
	}

	private handleDisconnectCharacter(_: IClientDirectoryUnconfirmedArgument['disconnectCharacter'], connection: IConnectionClient): void {
		if (!connection.isLoggedIn()) {
			throw new BadMessageError();
		}

		connection.character?.disconnect();
		connection.setCharacter(null);
		connection.sendConnectionStateUpdate();
	}

	private handleShardInfo(_: IClientDirectoryUnconfirmedArgument['shardInfo'], _connection: IConnectionClient): IClientDirectoryNormalResult['shardInfo'] {
		return {
			shards: ShardManager.listShads(),
		};
	}

	private handleListRooms(_: IClientDirectoryUnconfirmedArgument['listRooms'], connection: IConnectionClient): IClientDirectoryNormalResult['listRooms'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		return {
			rooms: ShardManager.listRooms().map((r) => r.getDirectoryInfo()),
		};
	}

	private async handleChatRoomCreate(roomConfig: IClientDirectoryUnconfirmedArgument['chatRoomCreate'], connection: IConnectionClient): IClientDirectoryPromiseResult['chatRoomCreate'] {
		if (!connection.isLoggedIn() || !connection.character || !IsIChatRoomDirectoryConfig(roomConfig))
			throw new BadMessageError();

		const room = ShardManager.createRoom(roomConfig);

		if (typeof room === 'string') {
			return { result: room };
		}

		const result = await connection.character.connectToShard({ room, refreshSecret: false });

		if (typeof result === 'string') {
			connection.setCharacter(null);
			return { result };
		}

		return ({
			...result,
			result: 'ok',
		});
	}

	private async handleChatRoomEnter({ id, password }: IClientDirectoryUnconfirmedArgument['chatRoomEnter'], connection: IConnectionClient): IClientDirectoryPromiseResult['chatRoomEnter'] {
		if (!connection.isLoggedIn() || !connection.character || !IsRoomId(id) || (password !== undefined && !IsString(password)))
			throw new BadMessageError();

		const room = ShardManager.getRoom(id);

		if (!room) {
			return { result: 'notFound' };
		}

		const allowResult = room.checkAllowEnter(connection.character, password);

		if (allowResult !== 'ok') {
			return { result: allowResult };
		}

		const result = await connection.character.connectToShard({ room, refreshSecret: false });

		if (typeof result === 'string') {
			connection.setCharacter(null);
			return { result };
		}

		return ({
			...result,
			result: 'ok',
		});
	}

	private handleChatRoomUpdate(roomConfig: IClientDirectoryUnconfirmedArgument['chatRoomUpdate'], connection: IConnectionClient): IClientDirectoryNormalResult['chatRoomUpdate'] {
		if (!connection.isLoggedIn() || !connection.character || !IsPartialIChatRoomDirectoryConfig(roomConfig))
			throw new BadMessageError();

		if (!connection.character.room) {
			return { result: 'notInRoom' };
		}

		if (!connection.character.room.isAdmin(connection.character)) {
			return { result: 'noAccess' };
		}

		const result = connection.character.room.update(roomConfig, connection.character);

		return { result };
	}

	private handleChatRoomLeave(_: IClientDirectoryUnconfirmedArgument['chatRoomLeave'], connection: IConnectionClient): void {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();
		connection.character.room?.removeCharacter(connection.character, 'leave');
	}

	/**
	 * Handle connect-time request for authentication using token
	 * @param connection - The connection that this message comes from
	 * @param username - Username from auth request
	 * @param token - Token secret from auth request
	 */
	private async handleAuth(connection: IConnectionClient, auth: IClientDirectoryAuthMessage): Promise<void> {
		// Find account by username
		const account = await accountManager.loadAccountByUsername(auth.username);
		// Verify the token validity
		if (account && account.secure.verifyLoginToken(auth.token)) {
			logger.verbose(`${connection.id} logged in as ${account.data.username} using token`);
			connection.setAccount(account);
			if (auth.character) {
				const char = account.characters.get(auth.character.id);
				if (char && char.connectSecret === auth.character.secret) {
					connection.setCharacter(char);
				}
			}
		}
		// Notify the client of the result
		connection.sendConnectionStateUpdate();
	}

	public onRoomListChange(): void {
		for (const connection of this.connectedClients) {
			// Only send updates to connections that can see the list (have character, but aren't in room)
			if (connection.character && !connection.character.room) {
				connection.sendMessage('somethingChanged', { changes: ['roomList'] });
			}
		}
	}

	public onShardListChange(): void {
		for (const connection of this.connectedClients) {
			connection.sendMessage('somethingChanged', { changes: ['shardList'] });
		}
	}
};

/** Checks if the given password is a base64 encode SHA-512 hash */
const IsPasswordSha512 = CreateStringValidator({
	regex: /^[a-zA-Z0-9+/]{86}==$/,
});

// TODO: Add length check for preview

const IsUpdateCharacter = CreateObjectValidator({
	id: IsCharacterId,
	preview: CreateBase64Validator(),
}, { noExtraKey: true });

/** Create a server status object to be sent to clients */
function MakeStatus(): IDirectoryStatus {
	const result: IDirectoryStatus = {
		time: Date.now(),
	};
	if (BETA_KEY) {
		result.betaKeyRequired = true;
	}
	return result;
}
