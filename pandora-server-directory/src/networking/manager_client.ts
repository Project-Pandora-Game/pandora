import { GetLogger, SpaceDirectoryConfigSchema, MessageHandler, IClientDirectory, IClientDirectoryArgument, IClientDirectoryPromiseResult, BadMessageError, IClientDirectoryResult, IClientDirectoryAuthMessage, IDirectoryStatus, AccountRole, ZodMatcher, ClientDirectoryAuthMessageSchema, IMessageHandler, AssertNotNullable, Assert, AssertNever, IShardTokenConnectInfo, Service, Awaitable, SecondFactorData, SecondFactorType, SecondFactorResponse } from 'pandora-common';
import { accountManager } from '../account/accountManager';
import { AccountProcedurePasswordReset, AccountProcedureResendVerifyEmail } from '../account/accountProcedures';
import { ENV } from '../config';
const { BETA_KEY_ENABLED, CHARACTER_LIMIT_NORMAL, HCAPTCHA_SECRET_KEY, HCAPTCHA_SITE_KEY } = ENV;
import { ShardManager } from '../shard/shardManager';
import type { Account } from '../account/account';
import { GitHubVerifier } from '../services/github/githubVerify';
import promClient from 'prom-client';
import { ShardTokenStore } from '../shard/shardTokenStore';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { BetaKeyStore } from '../shard/betaKeyStore';
import { SpaceManager } from '../spaces/spaceManager';
import type { ClientConnection } from './connection_client';
import { z } from 'zod';
import { Sleep } from '../utility';

/** Time (in ms) of how often the directory should send status updates */
export const STATUS_UPDATE_INTERVAL = 60_000;

/**
 * The constant time in milliseconds for the login, register, ...
 * This is used to ensure the functions takes a consistent amount of time to execute, helping to prevent timing attacks.
 */
const CONSTANT_TIME = 1000;

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

// TODO(spaces): Drop these
const IsIChatRoomDirectoryConfig = ZodMatcher(SpaceDirectoryConfigSchema);
const IsClientDirectoryAuthMessage = ZodMatcher(ClientDirectoryAuthMessageSchema);

/** Class that stores all currently connected clients */
export const ConnectionManagerClient = new class ConnectionManagerClient implements IMessageHandler<IClientDirectory, ClientConnection>, Service {
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
			login: WithConstantTime(this.handleLogin.bind(this), CONSTANT_TIME),
			register: WithConstantTime(this.handleRegister.bind(this), CONSTANT_TIME),
			resendVerificationEmail: WithConstantTime(this.handleResendVerificationEmail.bind(this), CONSTANT_TIME),
			passwordReset: WithConstantTime(this.handlePasswordReset.bind(this), CONSTANT_TIME),
			passwordResetConfirm: WithConstantTime(this.handlePasswordResetConfirm.bind(this), CONSTANT_TIME),

			// Account management
			passwordChange: this.handlePasswordChange.bind(this),
			logout: this.handleLogout.bind(this),
			gitHubBind: this.handleGitHubBind.bind(this),
			gitHubUnbind: this.handleGitHubUnbind.bind(this),
			changeSettings: this.handleChangeSettings.bind(this),
			setInitialCryptoKey: this.handleSetInitialCryptoKey.bind(this),

			getAccountContacts: this.handleGetAccountContacts.bind(this),
			getAccountInfo: this.handleGetAccountInfo.bind(this),
			updateProfileDescription: this.handleUpdateProfileDescription.bind(this),

			// Character management
			listCharacters: this.handleListCharacters.bind(this),
			createCharacter: this.handleCreateCharacter.bind(this),
			updateCharacter: this.handleUpdateCharacter.bind(this),
			deleteCharacter: this.handleDeleteCharacter.bind(this),

			// Character connection, shard interaction
			connectCharacter: this.handleConnectCharacter.bind(this),
			disconnectCharacter: this.handleDisconnectCharacter.bind(this),
			shardInfo: this.handleShardInfo.bind(this),
			listSpaces: this.handleListSpaces.bind(this),
			spaceGetInfo: this.handleSpaceGetInfo.bind(this),
			spaceCreate: this.handleSpaceCreate.bind(this),
			spaceEnter: this.handleSpaceEnter.bind(this),
			spaceLeave: this.handleSpaceLeave.bind(this),
			spaceUpdate: this.handleSpaceUpdate.bind(this),
			spaceAdminAction: this.handleSpaceAdminAction.bind(this),
			spaceOwnershipRemove: this.handleSpaceOwnershipRemove.bind(this),
			spaceInvite: this.handleSpaceInvite.bind(this),

			// Outfits
			storedOutfitsGetAll: this.handleStoredOutfitsGetAll.bind(this),
			storedOutfitsSave: this.handleStoredOutfitsSave.bind(this),

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
	private async handleLogin({ username, passwordSha512, verificationToken, secondFactor }: IClientDirectoryArgument['login'], connection: ClientConnection): IClientDirectoryPromiseResult['login'] {
		{
			const r = await LoginManager.testOptionalCaptcha(secondFactor);
			if (r != null)
				return r;
		}
		// Find account by username
		const account = await accountManager.loadAccountByUsername(username);
		// Verify the password
		if (!account || !await account.secure.verifyPassword(passwordSha512)) {
			LoginManager.loginFailed();
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

		const loadedCharacter = await char.requestLoad();

		const result = await loadedCharacter.connect(connection);

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

		const loadedCharacter = await char.requestLoad();

		const result = await loadedCharacter.connect(connection);

		return { result };
	}

	private async handleDisconnectCharacter(_: IClientDirectoryArgument['disconnectCharacter'], connection: ClientConnection): Promise<void> {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		await connection.character?.disconnect();
	}

	private handleShardInfo(_: IClientDirectoryArgument['shardInfo'], _connection: ClientConnection): IClientDirectoryResult['shardInfo'] {
		return {
			shards: ShardManager.listShads(),
		};
	}

	private async handleListSpaces(_: IClientDirectoryArgument['listSpaces'], connection: ClientConnection): IClientDirectoryPromiseResult['listSpaces'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const spaces = (await SpaceManager.listSpacesVisibleTo(connection.account))
			.map((r) => r.getListInfo(connection.account));

		return { spaces };
	}

	private async handleSpaceGetInfo({ id, invite }: IClientDirectoryArgument['spaceGetInfo'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceGetInfo'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const space = await SpaceManager.loadSpace(id);

		if (!space) {
			return { result: 'notFound' };
		}

		const allowResult = space.checkAllowEnter(connection.character, invite, { characterLimit: true });

		if (allowResult !== 'ok') {
			return { result: 'noAccess' };
		}

		return {
			result: 'success',
			data: space.getListExtendedInfo(connection.account),
			invite: space.getInvite(connection.character, invite),
		};
	}

	private async handleSpaceCreate(spaceConfig: IClientDirectoryArgument['spaceCreate'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceCreate'] {
		if (!connection.isLoggedIn() || !connection.character || !IsIChatRoomDirectoryConfig(spaceConfig))
			throw new BadMessageError();

		const character = connection.character;

		const space = await SpaceManager.createSpace(spaceConfig, [connection.account.id]);

		if (typeof space === 'string') {
			return { result: space };
		}

		const result = await character.joinSpace(space);
		Assert(result !== 'noAccess');
		Assert(result !== 'errFull');
		Assert(result !== 'invalidInvite');

		return { result };
	}

	private async handleSpaceEnter({ id, invite }: IClientDirectoryArgument['spaceEnter'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceEnter'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const character = connection.character;

		const space = await SpaceManager.loadSpace(id);

		if (!space) {
			return { result: 'notFound' };
		}

		const result = await character.joinSpace(space, invite);

		return { result };
	}

	private async handleSpaceUpdate(spaceConfig: IClientDirectoryArgument['spaceUpdate'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceUpdate'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		if (!connection.character.space) {
			return { result: 'notInPublicSpace' };
		}

		if (!connection.character.space.isAdmin(connection.account)) {
			return { result: 'noAccess' };
		}

		const result = await connection.character.space.update(spaceConfig, connection.character.baseInfo);

		return { result };
	}

	private async handleSpaceAdminAction({ action, targets }: IClientDirectoryArgument['spaceAdminAction'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceAdminAction'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		if (!connection.character.space) {
			return;
		}

		if (!connection.character.space.isAdmin(connection.account)) {
			return;
		}

		await connection.character.space.adminAction(connection.character.baseInfo, action, targets);
	}

	private async handleSpaceLeave(_: IClientDirectoryArgument['spaceLeave'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceLeave'] {
		if (!connection.isLoggedIn() || !connection.character)
			throw new BadMessageError();

		const result = await connection.character.leaveSpace();

		return { result };
	}

	private async handleSpaceOwnershipRemove({ id }: IClientDirectoryArgument['spaceOwnershipRemove'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceOwnershipRemove'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const space = await SpaceManager.loadSpace(id);

		if (space == null) {
			return { result: 'notAnOwner' };
		}

		const result = await space.removeOwner(connection.account.id);

		return { result };
	}

	private async handleSpaceInvite(req: IClientDirectoryArgument['spaceInvite'], connection: ClientConnection): IClientDirectoryPromiseResult['spaceInvite'] {
		if (!connection.isLoggedIn() || !connection.character?.space)
			throw new BadMessageError();

		switch (req.action) {
			case 'list':
				return {
					result: 'list',
					invites: connection.character.space.getInvites(connection.character),
				};
			case 'delete': {
				const result = await connection.character.space.deleteInvite(connection.character, req.id);
				return {
					result: result ? 'ok' : 'notFound',
				};
			}
			case 'create': {
				const result = await connection.character.space.createInvite(connection.character, req.data);
				if (typeof result === 'string')
					return { result };

				return {
					result: 'created',
					invite: result,
				};
			}
			default:
				AssertNever(req);
		}
	}

	private handleStoredOutfitsGetAll(_data: IClientDirectoryArgument['storedOutfitsGetAll'], connection: ClientConnection): IClientDirectoryResult['storedOutfitsGetAll'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		return {
			storedOutfits: connection.account.data.storedOutfits,
		};
	}

	private async handleStoredOutfitsSave({ storedOutfits }: IClientDirectoryArgument['storedOutfitsSave'], connection: ClientConnection): IClientDirectoryPromiseResult['storedOutfitsSave'] {
		if (!connection.isLoggedIn())
			throw new BadMessageError();

		const result = await connection.account.updateStoredOutfits(storedOutfits);

		if (result === 'ok') {
			return { result: 'ok' };
		}

		return {
			result: 'failed',
			reason: result,
		};
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
				const char = account.characters.get(auth.character.id)?.loadedCharacter;
				if (char && char.connectSecret === auth.character.secret) {
					await char.connect(connection, auth.character.secret);
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

	private async handleSetInitialCryptoKey({ cryptoKey }: IClientDirectoryArgument['setInitialCryptoKey'], connection: ClientConnection): IClientDirectoryPromiseResult['setInitialCryptoKey'] {
		if (!connection.account)
			throw new BadMessageError();

		const result = await connection.account.secure.setInitialCryptoKey(cryptoKey);

		return { result };
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

	private async handleGetDirectMessageInfo(_: IClientDirectoryArgument['getDirectMessageInfo'], connection: ClientConnection): IClientDirectoryPromiseResult['getDirectMessageInfo'] {
		if (!connection.account)
			throw new BadMessageError();

		const info = await connection.account.directMessages.getDirectMessageInfo();

		return { info };
	}

	private async handleDirectMessage({ id, action }: IClientDirectoryArgument['directMessage'], connection: ClientConnection): IClientDirectoryPromiseResult['directMessage'] {
		if (!connection.account)
			throw new BadMessageError();

		return await connection.account.directMessages.action(id, action);
	}

	//#endregion Direct Messages

	private async handleGetAccountContacts(_: IClientDirectoryArgument['getAccountContacts'], connection: ClientConnection): IClientDirectoryPromiseResult['getAccountContacts'] {
		if (!connection.account)
			throw new BadMessageError();

		const contacts = await connection.account.contacts.getAll();
		const friends = await connection.account.contacts.getFriendsStatus();

		return { friends, contacts };
	}

	private async handleGetAccountInfo({ accountId }: IClientDirectoryArgument['getAccountInfo'], connection: ClientConnection): IClientDirectoryPromiseResult['getAccountInfo'] {
		if (!connection.account)
			throw new BadMessageError();

		const queryingAccount = connection.account;
		const target = await accountManager.loadAccountById(accountId);

		if (target == null) {
			return { result: 'notFoundOrNoAccess' };
		}

		if (!await target.contacts.profileVisibleTo(queryingAccount)) {
			return { result: 'notFoundOrNoAccess' };
		}

		return {
			result: 'ok',
			info: target.getAccountPublicInfo(),
		};
	}

	private async handleUpdateProfileDescription({ profileDescription }: IClientDirectoryArgument['updateProfileDescription'], connection: ClientConnection): IClientDirectoryPromiseResult['updateProfileDescription'] {
		if (!connection.account)
			throw new BadMessageError();

		await connection.account.updateProfileDescription(profileDescription);

		return { result: 'ok' };
	}

	private async handleFriendRequest({ id, action }: IClientDirectoryArgument['friendRequest'], connection: ClientConnection): IClientDirectoryPromiseResult['friendRequest'] {
		if (!connection.account || id === connection.account.id)
			throw new BadMessageError();

		switch (action) {
			case 'accept':
				return { result: await connection.account.contacts.acceptFriendRequest(id) };
			case 'cancel':
				return { result: await connection.account.contacts.cancelFriendRequest(id) };
			case 'decline':
				return { result: await connection.account.contacts.declineFriendRequest(id) };
			case 'initiate':
				return { result: await connection.account.contacts.initiateFriendRequest(id) };
			default:
				AssertNever(action);
		}
	}

	private async handleUnfriend({ id }: IClientDirectoryArgument['unfriend'], connection: ClientConnection): IClientDirectoryPromiseResult['unfriend'] {
		if (!connection.account || id === connection.account.id)
			throw new BadMessageError();

		const success = await connection.account.contacts.removeFriend(id);
		return { result: success ? 'ok' : 'accountNotFound' };
	}

	private async handleBlockList({ id, action }: IClientDirectoryArgument['blockList'], connection: ClientConnection): IClientDirectoryPromiseResult['blockList'] {
		if (!connection.account || id === connection.account.id)
			throw new BadMessageError();

		switch (action) {
			case 'add':
				await connection.account.contacts.block(id);
				break;
			case 'remove':
				await connection.account.contacts.unblock(id);
				break;
			default:
				AssertNever(action);
		}
	}

	public onSpaceListChange(): void {
		for (const connection of this.connectedClients) {
			// Only send updates to connections that can see the list (have character, but aren't in a public space)
			if (connection.character && !connection.character.space) {
				connection.sendMessage('somethingChanged', { changes: ['spaceList'] });
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
	const { onlineAccounts, onlineCharacters } = accountManager.getOnlineCounts();

	const result: IDirectoryStatus = {
		time: Date.now(),
		onlineAccounts,
		onlineCharacters,
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
		const data: unknown = await response.json();
		const result = await VerifyResponseSchema.safeParseAsync(data);
		if (!result.success)
			return false;

		return result.data.success;
	} catch (e) {
		logger.error('Error verifying captcha', e);
		return false;
	}
}

/**
 * Creates a wrapper around a function to ensure it executes in a constant time, regardless of the original function's execution time.
 * This is useful for mitigating timing attacks, especially in security-sensitive operations like password checking.
 *
 * @param fn - The original function to be wrapped. This function can be asynchronous or return a promise.
 * @param delay - The total execution time (in milliseconds) that the wrapped function should take.
 * @returns A function that, when called, executes the original function and ensures that the total execution time meets the specified delay.
 * @template TParams - The type of the parameters passed to the original function.
 * @template TReturn - The type of the return value of the original function.
 */
function WithConstantTime<TParams extends unknown[], TReturn extends { /** only messages with actual response */ }>(fn: (...args: TParams) => Awaitable<TReturn>, delay: number): (...args: TParams) => Promise<Awaited<TReturn>> {
	return async (...args: TParams): Promise<Awaited<TReturn>> => {
		const before = Date.now();
		let result: [true, Awaited<TReturn>] | [false, unknown];
		try {
			result = [true, await fn(...args)];
		} catch (e) {
			result = [false, e];
		}
		const after = Date.now();
		const elapsed = after - before;
		const remaining = delay - elapsed;
		if (remaining > 0) {
			await Sleep(remaining);
		}
		if (!result[0]) {
			throw result[1];
		}
		return result[1];
	};
}

const LoginManager = new class LoginManager {
	private invalidAttempts: { readonly timestamp: number; }[] = [];

	public loginFailed(): void {
		const now = Date.now();
		this.invalidAttempts.push({ timestamp: now });
		this.invalidAttempts = this.invalidAttempts
			.slice(-ENV.LOGIN_ATTEMPT_LIMIT)
			.filter((attempt) => (attempt.timestamp + ENV.LOGIN_ATTEMPT_WINDOW) > now);
	}

	public async testOptionalCaptcha(data: SecondFactorData | undefined): Promise<null | SecondFactorResponse> {
		if (!this.isCaptchaRequired()) {
			return null;
		}
		const types: SecondFactorType[] = ['captcha'];
		if (data == null) {
			return { result: 'secondFactorRequired', types };
		}
		if (data.captcha == null) {
			return { result: 'secondFactorInvalid', types, invalid: [], missing: types };
		}
		if (!await TestCaptcha(data.captcha)) {
			return { result: 'secondFactorInvalid', types, invalid: types, missing: [] };
		}
		return null;
	}

	private isCaptchaRequired(): boolean {
		if (!HCAPTCHA_SECRET_KEY || !HCAPTCHA_SITE_KEY)
			return false;

		return this.invalidAttempts.length >= ENV.LOGIN_ATTEMPT_LIMIT && (this.invalidAttempts[0].timestamp + ENV.LOGIN_ATTEMPT_WINDOW) > Date.now();
	}
};
