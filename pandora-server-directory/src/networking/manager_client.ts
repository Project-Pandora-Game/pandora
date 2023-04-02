import { GetLogger, ChatRoomDirectoryConfigSchema, MessageHandler, IClientDirectory, IClientDirectoryArgument, IClientDirectoryPromiseResult, BadMessageError, IClientDirectoryResult, IClientDirectoryAuthMessage, IDirectoryStatus, AccountRole, ZodMatcher, ClientDirectoryAuthMessageSchema, IMessageHandler, AssertNotNullable, Assert, AssertNever } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../account/accountProcedures';
import { BETA_KEY_ENABLED, CHARACTER_LIMIT_NORMAL, HCAPTCHA_SECRET_KEY, HCAPTCHA_SITE_KEY } from '../config';
import { ShardManager } from '../shard/shardManager';
import type { Account } from '../account/account';
import { GitHubVerifier } from '../services/github/githubVerify';
import promClient from 'prom-client';
import { ShardTokenStore } from '../shard/shardTokenStore';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { BetaKeyStore } from '../shard/betaKeyStore';
import { RoomManager } from '../room/roomManager';
import type { ClientConnection } from './connection_client';
import { z } from 'zod';

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

const IsIChatRoomDirectoryConfig = ZodMatcher(ChatRoomDirectoryConfigSchema);
const IsClientDirectoryAuthMessage = ZodMatcher(ClientDirectoryAuthMessageSchema);

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient implements IMessageHandler<IClientDirectory, ClientConnection> {
	private connectedClients: Set<ClientConnection> = new Set();

	private readonly messageHandler: MessageHandler<IClientDirectory, ClientConnection>;

	public async onMessage<K extends keyof IClientDirectory>(
		messageType: K,
		message: SocketInterfaceRequest<IClientDirectory>[K],
		context: ClientConnection,
	): Promise<SocketInterfaceResponse<IClientDirectory>[K]> {
		messagesMetric.inc({ messageType });
		return this.messageHandler.onMessage(messageType, message, context);
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
		this.messageHandler = new MessageHandler<IClientDirectory, ClientConnection>({
			// Before Login
			login: this.handleLogin.bind(this),
			register: this.handleRegister.bind(this),
			resendVerificationEmail: this.handleResendVerificationEmail.bind(this),
			passwordReset: this.handlePasswordReset.bind(this),
			passwordResetConfirm: this.handlePasswordResetConfirm.bind(this),

			// Account management
			passwordChange: this.handlePasswordChange.bind(this),
			logout: this.handleLogout.bind(this),
			gitHubBind: this.handleGitHubBind.bind(this),
			gitHubUnbind: this.handleGitHubUnbind.bind(this),
			changeSettings: this.handleChangeSettings.bind(this),
			setCryptoKey: this.handleSetCryptoKey.bind(this),

			// Character management
			listCharacters: this.handleListCharacters.bind(this),
			createCharacter: this.handleCreateCharacter.bind(this),
			updateCharacter: this.handleUpdateCharacter.bind(this),
			deleteCharacter: this.handleDeleteCharacter.bind(this),

			// Character connection, shard interaction
			connectCharacter: this.handleConnectCharacter.bind(this),
			disconnectCharacter: this.handleDisconnectCharacter.bind(this),
			shardInfo: this.handleShardInfo.bind(this),
			listRooms: this.handleListRooms.bind(this),
			chatRoomGetInfo: this.handleChatRoomGetInfo.bind(this),
			chatRoomCreate: this.handleChatRoomCreate.bind(this),
			chatRoomEnter: this.handleChatRoomEnter.bind(this),
			chatRoomLeave: this.handleChatRoomLeave.bind(this),
			chatRoomUpdate: this.handleChatRoomUpdate.bind(this),
			chatRoomAdminAction: this.handleChatRoomAdminAction.bind(this),
			chatRoomOwnershipRemove: this.handleChatRoomOwnershipRemove.bind(this),

			getDirectMessages: this.handleGetDirectMessages.bind(this),
			sendDirectMessage: this.handleSendDirectMessage.bind(this),
			directMessage: this.handleDirectMessage.bind(this),
			getDirectMessageInfo: this.handleGetDirectMessageInfo.bind(this),
			friendRequest: this.handleFriendRequest.bind(this),
			unfriend: this.handleUnfriend.bind(this),
			blockList: this.handleBlockList.bind(this),

			// Management/admin endpoints; these require specific roles to be used
			manageGetAccountRoles: Auth('developer', this.handleManageGetAccountRoles.bind(this)),
			manageSetAccountRole: Auth('developer', this.handleManageSetAccountRole.bind(this)),
			manageCreateShardToken: Auth('developer', this.handleManageCreateShardToken.bind(this)),
			manageInvalidateShardToken: Auth('developer', this.handleManageInvalidateShardToken.bind(this)),
			manageListShardTokens: Auth('developer', this.handleManageListShardTokens.bind(this)),
			manageCreateBetaKey: Auth('developer', this.handleManageCreateBetaKey.bind(this)),
			manageListBetaKeys: Auth('developer', this.handleManageListBetaKeys.bind(this)),
			manageInvalidateBetaKey: Auth('developer', this.handleManageInvalidateBetaKey.bind(this)),
		});
	}

	/** Handle new incoming connection */
	public onConnect(connection: ClientConnection, auth: unknown): void {
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
	public onDisconnect(connection: ClientConnection): void {
		if (!this.connectedClients.has(connection)) {
			logger.fatal('Assertion failed: client disconnect while not in connectedClients', connection);
			return;
		}
		this.connectedClients.delete(connection);
		connectedClientsMetric.set(this.connectedClients.size);
		connection.setAccount(null);
	}

	/**
	 * Handle `login` message from client
	 * @param message - Content of the message
	 * @param connection - The connection that this message comes from
	 * @returns Result of the login
	 */
	private async handleLogin({ username, passwordSha512, verificationToken }: IClientDirectoryArgument['login'], connection: ClientConnection): IClientDirectoryPromiseResult['login'] {
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
			relationships: await account.relationship.getAll(),
			friends: [],
		};
	}

	private async handleLogout({ invalidateToken }: IClientDirectoryArgument['logout'], connection: ClientConnection): IClientDirectoryPromiseResult['logout'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const account = connection.account;
		const character = connection.character;

		connection.setAccount(null);
		connection.sendConnectionStateUpdate();
		logger.verbose(`${connection.id} logged out`);

		if (invalidateToken) {
			await account.secure.invalidateLoginToken(invalidateToken);
		}
		await character?.disconnect();
	}

	private async handleRegister({ username, email, passwordSha512, betaKey, captchaToken }: IClientDirectoryArgument['register'], connection: ClientConnection): IClientDirectoryPromiseResult['register'] {
		if (connection.isLoggedIn())
			throw new BadMessageError();

		if (!await TestCaptcha(captchaToken))
			return { result: 'invalidCaptcha' };

		if (BETA_KEY_ENABLED && (!betaKey || !await BetaKeyStore.use(betaKey)))
			return { result: 'invalidBetaKey' };

		const result = await accountManager.createAccount(username, passwordSha512, email);
		if (typeof result === 'string') {
			if (BETA_KEY_ENABLED && betaKey) await BetaKeyStore.free(betaKey);
			return { result };
		}

		return { result: 'ok' };
	}

	private async handleResendVerificationEmail({ email, captchaToken }: IClientDirectoryArgument['resendVerificationEmail'], connection: ClientConnection): IClientDirectoryPromiseResult['resendVerificationEmail'] {
		if (connection.isLoggedIn())
			throw new BadMessageError();

		if (!await TestCaptcha(captchaToken))
			return { result: 'invalidCaptcha' };

		await AccountProcedureResendVerifyEmail(email);

		return { result: 'maybeSent' };
	}

	private async handlePasswordReset({ email, captchaToken }: IClientDirectoryArgument['passwordReset'], connection: ClientConnection): IClientDirectoryPromiseResult['passwordReset'] {
		if (connection.isLoggedIn())
			throw new BadMessageError();

		if (!await TestCaptcha(captchaToken))
			return { result: 'invalidCaptcha' };

		await AccountProcedurePasswordReset(email);

		return { result: 'maybeSent' };
	}

	private async handlePasswordResetConfirm({ username, token, passwordSha512 }: IClientDirectoryArgument['passwordResetConfirm'], connection: ClientConnection): IClientDirectoryPromiseResult['passwordResetConfirm'] {
		if (connection.isLoggedIn())
			throw new BadMessageError();

		const account = await accountManager.loadAccountByUsername(username);
		if (!await account?.secure.finishPasswordReset(token, passwordSha512))
			return { result: 'unknownCredentials' };

		return { result: 'ok' };
	}

	private async handlePasswordChange({ passwordSha512Old, passwordSha512New, cryptoKey }: IClientDirectoryArgument['passwordChange'], connection: ClientConnection): IClientDirectoryPromiseResult['passwordChange'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		if (!await connection.account.secure.changePassword(passwordSha512Old, passwordSha512New, cryptoKey))
			return { result: 'invalidPassword' };

		return { result: 'ok' };
	}

	private handleListCharacters(_: IClientDirectoryArgument['listCharacters'], connection: ClientConnection): IClientDirectoryResult['listCharacters'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		return {
			characters: connection.account.listCharacters(),
			limit: CHARACTER_LIMIT_NORMAL,
		};
	}

	private async handleCreateCharacter(_: IClientDirectoryArgument['createCharacter'], connection: ClientConnection): IClientDirectoryPromiseResult['createCharacter'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const char = await connection.account.createCharacter();
		if (!char)
			return { result: 'maxCharactersReached' };

		const result = await char.connect(connection);

		return { result };
	}

	private async handleUpdateCharacter(arg: IClientDirectoryArgument['updateCharacter'], connection: ClientConnection): IClientDirectoryPromiseResult['updateCharacter'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const character = connection.account.characters.get(arg.id);

		if (!character)
			throw new BadMessageError();

		const info = await character.updateSelfData(arg);
		if (!info)
			throw new Error(`Failed to update character ${arg.id}`);

		return info;
	}

	private async handleDeleteCharacter({ id }: IClientDirectoryArgument['deleteCharacter'], connection: ClientConnection): IClientDirectoryPromiseResult['deleteCharacter'] {
		if (!connection.isLoggedIn() || !connection.account.hasCharacter(id))
			throw new BadMessageError();

		const success = await connection.account.deleteCharacter(id);
		if (!success)
			return { result: 'characterInUse' };

		return { result: 'ok' };
	}

	private async handleConnectCharacter({ id }: IClientDirectoryArgument['connectCharacter'], connection: ClientConnection): IClientDirectoryPromiseResult['connectCharacter'] {
		if (!connection.isLoggedIn() || !connection.account.hasCharacter(id))
			throw new BadMessageError();

		const char = connection.account.characters.get(id);
		AssertNotNullable(char);

		const result = await char.connect(connection);

		return { result };
	}

	private async handleDisconnectCharacter(_: IClientDirectoryArgument['disconnectCharacter'], connection: ClientConnection): Promise<void> {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		await connection.character?.disconnect();
		connection.setCharacter(null);
		connection.sendConnectionStateUpdate();
	}

	private handleShardInfo(_: IClientDirectoryArgument['shardInfo'], _connection: ClientConnection): IClientDirectoryResult['shardInfo'] {
		return {
			shards: ShardManager.listShads(),
		};
	}

	private async handleListRooms(_: IClientDirectoryArgument['listRooms'], connection: ClientConnection): IClientDirectoryPromiseResult['listRooms'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const rooms = (await RoomManager.listRoomsVisibleTo(connection.account))
			.map((r) => r.getRoomListInfo(connection.account));

		return { rooms };
	}

	private async handleChatRoomGetInfo({ id }: IClientDirectoryArgument['chatRoomGetInfo'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomGetInfo'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const room = await RoomManager.loadRoom(id);

		if (!room) {
			return { result: 'notFound' };
		}

		const allowResult = room.checkAllowEnter(connection.character, null, true);

		if (allowResult !== 'ok') {
			return { result: 'noAccess' };
		}

		return {
			result: 'success',
			data: room.getRoomListExtendedInfo(connection.account),
		};
	}

	private async handleChatRoomCreate(roomConfig: IClientDirectoryArgument['chatRoomCreate'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomCreate'] {
		if (!connection.isLoggedIn() || !connection.character || !IsIChatRoomDirectoryConfig(roomConfig))
			throw new BadMessageError();

		const character = connection.character;

		const room = await RoomManager.createRoom(roomConfig, [connection.account.id]);

		if (typeof room === 'string') {
			return { result: room };
		}

		const result = await character.joinRoom(room, true, null);
		Assert(result !== 'noAccess');
		Assert(result !== 'errFull');
		Assert(result !== 'invalidPassword');

		return { result };
	}

	private async handleChatRoomEnter({ id, password }: IClientDirectoryArgument['chatRoomEnter'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomEnter'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const character = connection.character;

		const room = await RoomManager.loadRoom(id);

		if (!room) {
			return { result: 'notFound' };
		}

		const result = await character.joinRoom(room, true, password ?? null);

		return { result };
	}

	private async handleChatRoomUpdate(roomConfig: IClientDirectoryArgument['chatRoomUpdate'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomUpdate'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		if (!connection.character.room) {
			return { result: 'notInRoom' };
		}

		if (!connection.character.room.isAdmin(connection.account)) {
			return { result: 'noAccess' };
		}

		const result = await connection.character.room.update(roomConfig, connection.character);

		return { result };
	}

	private async handleChatRoomAdminAction({ action, targets }: IClientDirectoryArgument['chatRoomAdminAction'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomAdminAction'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		if (!connection.character.room) {
			return;
		}

		if (!connection.character.room.isAdmin(connection.account)) {
			return;
		}

		await connection.character.room.adminAction(connection.character, action, targets);
	}

	private async handleChatRoomLeave(_: IClientDirectoryArgument['chatRoomLeave'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomLeave'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const result = await connection.character.leaveRoom();

		return { result };
	}

	private async handleChatRoomOwnershipRemove({ id }: IClientDirectoryArgument['chatRoomOwnershipRemove'], connection: ClientConnection): IClientDirectoryPromiseResult['chatRoomOwnershipRemove'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const room = await RoomManager.loadRoom(id);

		if (room == null || !room.owners.has(connection.account.id)) {
			return { result: 'notAnOwner' };
		}

		const result = await room.removeOwner(connection.account.id);

		return { result };
	}

	/**
	 * Handle connect-time request for authentication using token
	 * @param connection - The connection that this message comes from
	 * @param username - Username from auth request
	 * @param token - Token secret from auth request
	 */
	private async handleAuth(connection: ClientConnection, auth: IClientDirectoryAuthMessage): Promise<void> {
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

	private handleGitHubBind({ login }: IClientDirectoryArgument['gitHubBind'], connection: ClientConnection): IClientDirectoryResult['gitHubBind'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const url = GitHubVerifier.prepareLink(connection.account.id, login) || 'GitHub Verify API Not Supported';
		return { url };
	}

	private async handleGitHubUnbind(_: IClientDirectoryArgument['gitHubUnbind'], connection: ClientConnection): IClientDirectoryPromiseResult['gitHubUnbind'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		await connection.account.secure.setGitHubInfo(null);
	}

	private async handleChangeSettings(settings: IClientDirectoryArgument['changeSettings'], connection: ClientConnection): IClientDirectoryPromiseResult['changeSettings'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		await connection.account.changeSettings(settings);
	}

	private async handleManageGetAccountRoles({ id }: IClientDirectoryArgument['manageGetAccountRoles']): IClientDirectoryPromiseResult['manageGetAccountRoles'] {
		const account = await accountManager.loadAccountById(id);
		if (!account)
			return { result: 'notFound' };

		return {
			result: 'ok',
			roles: account.roles.getAdminInfo(),
		};
	}

	private async handleManageSetAccountRole({ id, role, expires }: IClientDirectoryArgument['manageSetAccountRole'], connection: ClientConnection & { readonly account: Account; }): IClientDirectoryPromiseResult['manageSetAccountRole'] {
		const account = await accountManager.loadAccountById(id);
		if (!account)
			return { result: 'notFound' };

		await account.roles.setRole(connection.account, role, expires);
		return { result: 'ok' };
	}

	private async handleManageCreateShardToken({ type, expires }: IClientDirectoryArgument['manageCreateShardToken'], connection: ClientConnection & { readonly account: Account; }): IClientDirectoryPromiseResult['manageCreateShardToken'] {
		const result = await ShardTokenStore.create(connection.account, { type, expires });
		if (typeof result === 'string')
			return { result };

		return {
			result: 'ok',
			...result,
		};
	}

	private async handleManageInvalidateShardToken({ id }: IClientDirectoryArgument['manageInvalidateShardToken'], connection: ClientConnection & { readonly account: Account; }): IClientDirectoryPromiseResult['manageInvalidateShardToken'] {
		return { result: await ShardTokenStore.revoke(connection.account, id) };
	}

	private handleManageListShardTokens(_: IClientDirectoryArgument['manageListShardTokens'], _connection: ClientConnection & { readonly account: Account; }): IClientDirectoryResult['manageListShardTokens'] {
		const info = ShardTokenStore.list()
			.map<IShardTokenConnectInfo>((token) => {
				const connection = ShardManager.getShard(token.id)?.shardConnection;
				return {
					...token,
					connected: connection?.connectionTime,
				};
			});
		return { info };
	}

	private async handleManageCreateBetaKey({ expires, maxUses }: IClientDirectoryArgument['manageCreateBetaKey'], connection: ClientConnection & { readonly account: Account; }): IClientDirectoryPromiseResult['manageCreateBetaKey'] {
		const result = await BetaKeyStore.create(connection.account, { expires, maxUses });
		if (typeof result === 'string')
			return { result };

		return {
			result: 'ok',
			...result,
		};
	}

	private handleManageListBetaKeys(_: IClientDirectoryArgument['manageListBetaKeys'], _connection: ClientConnection & { readonly account: Account; }): IClientDirectoryResult['manageListBetaKeys'] {
		const keys = BetaKeyStore.list();
		return { keys };
	}

	private async handleManageInvalidateBetaKey({ id }: IClientDirectoryArgument['manageInvalidateBetaKey'], connection: ClientConnection & { readonly account: Account; }): IClientDirectoryPromiseResult['manageInvalidateBetaKey'] {
		return { result: await BetaKeyStore.revoke(connection.account, id) };
	}

	//#region Direct Messages

	private async handleSetCryptoKey({ cryptoKey }: IClientDirectoryArgument['setCryptoKey'], connection: ClientConnection): IClientDirectoryPromiseResult['setCryptoKey'] {
		if (!connection.account)
			throw new BadMessageError();

		await connection.account.secure.setCryptoKey(cryptoKey);
	}

	private async handleGetDirectMessages({ id, until }: IClientDirectoryArgument['getDirectMessages'], connection: ClientConnection): IClientDirectoryPromiseResult['getDirectMessages'] {
		if (!connection.account || id === connection.account.id)
			throw new BadMessageError();

		return await connection.account.directMessages.getMessages(id, until);
	}

	private async handleSendDirectMessage(data: IClientDirectoryArgument['sendDirectMessage'], connection: ClientConnection): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!connection.account || data.id === connection.account.id)
			throw new BadMessageError();

		return await connection.account.directMessages.sendMessage(data);
	}

	private handleGetDirectMessageInfo(_: IClientDirectoryArgument['getDirectMessageInfo'], connection: ClientConnection): IClientDirectoryResult['getDirectMessageInfo'] {
		if (!connection.account)
			throw new BadMessageError();

		return { info: connection.account.directMessages.dms };
	}

	private async handleDirectMessage({ id, action }: IClientDirectoryArgument['directMessage'], connection: ClientConnection): IClientDirectoryPromiseResult['directMessage'] {
		if (!connection.account)
			throw new BadMessageError();

		return await connection.account.directMessages.action(id, action);
	}

	//#endregion Direct Messages

	private async handleFriendRequest({ id, action }: IClientDirectoryArgument['friendRequest'], connection: ClientConnection): IClientDirectoryPromiseResult['friendRequest'] {
		if (!connection.account)
			throw new BadMessageError();

		switch (action) {
			case 'initiate': {
				const success = await connection.account.relationship.initiateFriendRequest(id);
				return { result: success ? 'ok' : 'accountNotFound' };
			}
			case 'accept': {
				const success = await connection.account.relationship.acceptFriendRequest(id);
				return { result: success ? 'ok' : 'requestNotFound' };
			}
			case 'decline': {
				const success = await connection.account.relationship.declineFriendRequest(id);
				return { result: success ? 'ok' : 'requestNotFound' };
			}
			case 'cancel': {
				const success = await connection.account.relationship.cancelFriendRequest(id);
				return { result: success ? 'ok' : 'requestNotFound' };
			}
			default:
				AssertNever(action);
		}
	}

	private async handleUnfriend({ id }: IClientDirectoryArgument['unfriend'], connection: ClientConnection): IClientDirectoryPromiseResult['unfriend'] {
		if (!connection.account)
			throw new BadMessageError();

		const success = await connection.account.relationship.removeFriend(id);
		return { result: success ? 'ok' : 'accountNotFound' };
	}

	private async handleBlockList({ id, action }: IClientDirectoryArgument['blockList'], connection: ClientConnection): IClientDirectoryPromiseResult['blockList'] {
		if (!connection.account)
			throw new BadMessageError();

		switch (action) {
			case 'add':
				await connection.account.relationship.block(id);
				break;
			case 'remove':
				await connection.account.relationship.unblock(id);
				break;
			default:
				AssertNever(action);
		}
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

function Auth<T, R>(role: AccountRole, handler: (args: T, connection: ClientConnection & { readonly account: Account; }) => R): (args: T, connection: ClientConnection) => R {
	return (args: T, connection: ClientConnection) => {
		if (!connection.isLoggedIn())
			throw new BadMessageError();
		if (!connection.account.roles.isAuthorized(role))
			throw new BadMessageError();

		return handler(args, connection);
	};
}

/** Create a server status object to be sent to clients */
function MakeStatus(): IDirectoryStatus {
	const result: IDirectoryStatus = {
		time: Date.now(),
	};
	if (BETA_KEY_ENABLED) {
		result.betaKeyRequired = true;
	}
	if (HCAPTCHA_SECRET_KEY && HCAPTCHA_SECRET_KEY) {
		result.captchaSiteKey = HCAPTCHA_SITE_KEY;
	}
	return result;
}

const VerifyResponseSchema = z.object({
	success: z.boolean(),
}).passthrough();

async function TestCaptcha(token?: string): Promise<boolean> {
	if (!HCAPTCHA_SECRET_KEY || !HCAPTCHA_SITE_KEY)
		return true;

	if (!token)
		return false;

	try {
		const response = await fetch('https://hcaptcha.com/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				secret: HCAPTCHA_SECRET_KEY,
				sitekey: HCAPTCHA_SITE_KEY,
				response: token,
			}),
		});
		const data = await response.json() as unknown;
		const result = await VerifyResponseSchema.safeParseAsync(data);
		if (!result.success)
			return false;

		return result.data.success;
	} catch (e) {
		logger.error('Error verifying captcha', e);
		return false;
	}
}
