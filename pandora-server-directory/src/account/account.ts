import { cloneDeep, omit, remove, uniq } from 'lodash-es';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	ACCOUNT_SETTINGS_LIMITED_LIMITS,
	AccountId,
	AccountPublicInfo,
	Assert,
	AssetFrameworkOutfitWithId,
	AsyncSynchronized,
	CharacterId,
	CharacterSelfInfo,
	GetLogger,
	IDirectoryAccountInfo,
	IDirectoryClient,
	IShardAccountDefinition,
	ITEM_LIMIT_ACCOUNT_OUTFIT_STORAGE,
	KnownObject,
	LIMIT_ACCOUNT_POSE_PRESET_STORAGE,
	LIMIT_CHARACTER_COUNT,
	LIMIT_SPACE_OWNED_COUNT,
	OutfitMeasureCost,
	ServerRoom,
	TimeSpanMs,
	type AccountSettings,
	type AccountSettingsKeys,
	type AssetFrameworkPosePresetWithId,
	type Logger,
	type ManagementAccountInfo,
} from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider.ts';
import { DatabaseAccount, DatabaseAccountUpdate, DatabaseAccountWithSecure, DirectMessageAccounts, type DatabaseCharacterSelfInfo } from '../database/databaseStructure.ts';
import type { ClientConnection } from '../networking/connection_client.ts';
import { AsyncInterval } from '../utility.ts';
import { AccountContacts } from './accountContacts.ts';
import { AccountDirectMessages } from './accountDirectMessages.ts';
import { AccountRoles } from './accountRoles.ts';
import AccountSecure, { GenerateAccountSecureData } from './accountSecure.ts';
import type { ActorIdentity } from './actorIdentity.ts';
import { CharacterInfo } from './character.ts';

/** Currently logged in or recently used account */
export class Account implements ActorIdentity {
	private readonly logger: Logger;
	private readonly cleanupInterval: AsyncInterval;

	/** Time when this account was last used */
	public lastActivity: number;
	/** The account's saved data */
	public data: Omit<DatabaseAccount, 'secure' | 'characters'>;
	/** List of connections logged in as this account */
	public readonly associatedConnections = new ServerRoom<IDirectoryClient, ClientConnection>();

	public readonly characters: Map<CharacterId, CharacterInfo> = new Map();

	public readonly secure: AccountSecure;
	public readonly roles: AccountRoles;
	public readonly directMessages: AccountDirectMessages;
	public readonly contacts: AccountContacts;

	public get id(): AccountId {
		return this.data.id;
	}

	public get username(): string {
		return this.data.username;
	}

	public get displayName(): string {
		return this.data.settings.displayName ?? this.data.username;
	}

	constructor(data: DatabaseAccountWithSecure, characters: readonly DatabaseCharacterSelfInfo[]) {
		this.logger = GetLogger('Account', `[Account ${data.id}]`);
		this.lastActivity = Date.now();
		// Shallow copy to preserve received data when cleaning up secure
		this.data = omit(data, 'secure', 'roles', 'characters');

		// Init subsystems
		this.secure = new AccountSecure(this, data.secure);
		this.roles = new AccountRoles(this, data.roles);
		this.directMessages = new AccountDirectMessages(this, data.directMessages);
		this.contacts = new AccountContacts(this);

		// Init characters
		for (const characterData of characters) {
			this.characters.set(characterData.id, new CharacterInfo(characterData, this));
		}

		this.cleanupInterval = new AsyncInterval(
			() => this._doCleanupAsync(),
			TimeSpanMs(1, 'minutes'),
			(err) => this.logger.error('Account cleanup failed:', err),
		).start();
	}

	public onUnload(): void {
		this.cleanupInterval.stop();
	}

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	/** Checks if the account is activated */
	public isActivated(): boolean {
		return this.secure.isActivated();
	}

	public isInUse(): boolean {
		return this.associatedConnections.hasClients() || Array.from(this.characters.values()).some((c) => c.isInUse());
	}

	public isOnline(): boolean {
		return this.associatedConnections.hasClients() || Array.from(this.characters.values()).some((c) => c.isOnline());
	}

	/** Build account part of `connectionState` update message for connection */
	public getAccountInfo(): IDirectoryAccountInfo {
		return {
			id: this.data.id,
			username: this.data.username,
			displayName: this.displayName,
			created: this.data.created,
			github: this.secure.getGitHubStatus(),
			roles: this.roles.getSelfInfo(),
			spaceOwnershipLimit: this.spaceOwnershipLimit,
			settings: cloneDeep(this.data.settings),
			settingsCooldowns: cloneDeep(this.data.settingsCooldowns),
			cryptoKey: this.secure.getCryptoKey(),
		};
	}

	/**
	 * Resolves full account settings to their effective values.
	 * @returns The settings that apply to this account.
	 */
	public getEffectiveSettings(): Readonly<AccountSettings> {
		return {
			...ACCOUNT_SETTINGS_DEFAULT,
			...this.data.settings,
		};
	}

	/** The info that is visible to public (with some limitations) */
	public getAccountPublicInfo(): AccountPublicInfo {
		const settings = this.getEffectiveSettings();

		return {
			id: this.data.id,
			displayName: this.displayName,
			labelColor: settings.labelColor,
			created: this.data.created,
			visibleRoles: uniq(settings.visibleRoles.filter((role) => this.roles.isAuthorized(role))),
			profileDescription: this.data.profileDescription,
		};
	}

	public getShardAccountDefinition(): IShardAccountDefinition {
		return {
			id: this.id,
			displayName: this.displayName,
			roles: this.roles.getSelfInfo(),
			onlineStatus: this.isOnline() ? (this.data.settings.onlineStatus ?? 'online') : 'offline',
		};
	}

	public getAdminInfo(): Readonly<ManagementAccountInfo> {
		return cloneDeep<ManagementAccountInfo>({
			id: this.id,
			username: this.username,
			displayName: this.displayName,
			onlineStatus: this.isOnline() ? (this.data.settings.onlineStatus ?? 'online') : null,
			created: this.data.created,
			secure: this.secure.getAdminInfo(),
			characters: Array.from(this.characters.values()).map((c) => c.getAdminInfo()),
			roles: this.roles.getAdminInfo(),
		});
	}

	@AsyncSynchronized('object')
	public async changeSettings(settings: Partial<AccountSettings>): Promise<void> {
		if (settings.visibleRoles) {
			settings.visibleRoles = uniq(settings.visibleRoles.filter((role) => this.roles.isAuthorized(role)));
		}

		const db = GetDatabase();
		const update: DatabaseAccountUpdate = {};

		const now = Date.now();
		for (const [key, limit] of KnownObject.entries(ACCOUNT_SETTINGS_LIMITED_LIMITS)) {
			if (limit == null || !(key in settings))
				continue;

			const cooldown = this.data.settingsCooldowns[key] ?? 0;
			if (cooldown > now) {
				delete settings[key];
				continue;
			}

			let settingsCooldowns = update.settingsCooldowns;
			if (!settingsCooldowns) {
				settingsCooldowns = cloneDeep(this.data.settingsCooldowns);
				update.settingsCooldowns = settingsCooldowns;
			}

			settingsCooldowns[key] = limit + now;
		}

		if (settings.displayName === this.data.username)
			settings.displayName = null;
		if (update.settingsCooldowns != null)
			this.data.settingsCooldowns = update.settingsCooldowns;

		this.data.settings = { ...this.data.settings, ...settings };
		update.settings = this.data.settings;

		await db.updateAccountData(this.data.id, update);
		this.onAccountInfoChange();
	}

	@AsyncSynchronized('object')
	public async resetSettings(settings: readonly AccountSettingsKeys[]): Promise<void> {
		const db = GetDatabase();
		const update: DatabaseAccountUpdate = {};

		// Mark modified limited settings cooldowns (reset triggers cooldown as well)
		const now = Date.now();
		for (const [key, limit] of KnownObject.entries(ACCOUNT_SETTINGS_LIMITED_LIMITS)) {
			if (limit == null || !settings.includes(key))
				continue;

			const cooldown = this.data.settingsCooldowns[key] ?? 0;
			if (cooldown > now) {
				remove(settings, (i) => i === key);
				continue;
			}

			let settingsCooldowns = update.settingsCooldowns;
			if (!settingsCooldowns) {
				settingsCooldowns = cloneDeep(this.data.settingsCooldowns);
				update.settingsCooldowns = settingsCooldowns;
			}

			settingsCooldowns[key] = limit + now;
		}

		if (update.settingsCooldowns != null)
			this.data.settingsCooldowns = update.settingsCooldowns;

		for (const setting of settings) {
			delete this.data.settings[setting];
		}
		update.settings = this.data.settings;

		await db.updateAccountData(this.data.id, update);
		this.onAccountInfoChange();
	}

	@AsyncSynchronized()
	public async updateProfileDescription(newDescription: string): Promise<void> {
		this.data.profileDescription = newDescription.trim();

		// Save the changed data
		await GetDatabase().updateAccountData(this.data.id, {
			profileDescription: this.data.profileDescription,
		});
	}

	@AsyncSynchronized()
	public async updateStoredOutfits(outfits: AssetFrameworkOutfitWithId[]): Promise<'ok' | 'storageFull'> {
		const totalCost = outfits.reduce((p, outfit) => p + OutfitMeasureCost(outfit), 0);
		if (!Number.isInteger(totalCost) || totalCost > ITEM_LIMIT_ACCOUNT_OUTFIT_STORAGE) {
			return 'storageFull';
		}

		this.data.storedOutfits = outfits;

		// Save the changed data
		await GetDatabase().updateAccountData(this.data.id, {
			storedOutfits: this.data.storedOutfits,
		});
		// Notify connected clients that the outfit storage changed
		this.associatedConnections.sendMessage('somethingChanged', {
			changes: ['storedOutfits'],
		});

		return 'ok';
	}

	@AsyncSynchronized()
	public async updateStoredPosePresets(poses: AssetFrameworkPosePresetWithId[]): Promise<'ok' | 'storageFull'> {
		const totalCost = poses.length;
		if (!Number.isInteger(totalCost) || totalCost > LIMIT_ACCOUNT_POSE_PRESET_STORAGE) {
			return 'storageFull';
		}

		this.data.storedPosePresets = poses;

		// Save the changed data
		await GetDatabase().updateAccountData(this.data.id, {
			storedPosePresets: this.data.storedPosePresets,
		});
		// Notify connected clients that the outfit storage changed
		this.associatedConnections.sendMessage('somethingChanged', {
			changes: ['storedPosePresets'],
		});

		return 'ok';
	}

	public async onManagerDestroy(): Promise<void> {
		// Disconnect all characters
		for (const character of this.characters.values()) {
			await character.loadedCharacter?.disconnect();
		}

		// Disconnect clients
		for (const client of this.associatedConnections.clients.slice()) {
			client.setAccount(null);
		}
		Assert(!this.associatedConnections.hasClients());
	}

	//#region Character

	public listCharacters(): CharacterSelfInfo[] {
		return Array.from(this.characters.values()).map((character) => ({
			...character.data,
			state: character.getInfoState(),
		}));
	}

	public async createCharacter(): Promise<CharacterInfo | null> {
		if (this.characters.size > LIMIT_CHARACTER_COUNT || Array.from(this.characters.values()).some((i) => i.inCreation))
			return null;

		const info = await GetDatabase().createCharacter(this.data.id);
		const character = new CharacterInfo(info, this);
		this.characters.set(info.id, character);

		this.logger.info(`Created a new character ${info.id}`);

		this.onCharacterListChange();

		return character;
	}

	@AsyncSynchronized('object')
	public async deleteCharacter(characterId: CharacterId, passwordSha512: string): Promise<true | 'invalidPassword' | 'failed'> {
		if (!await this.secure.verifyPassword(passwordSha512))
			return 'invalidPassword';

		// If there is no such character, then implicit success
		const character = this.characters.get(characterId);
		if (character == null)
			return true;

		await character.forceUnload(true);

		// Check if unload without race conditions was successful
		if (character.isValid)
			return 'failed';

		Assert(character.loadedCharacter == null);

		// Actually delete the character
		this.logger.info(`Deleting character ${character.id}`);
		this.characters.delete(character.id);
		await GetDatabase().deleteCharacter(this.data.id, character.id);

		this.onCharacterListChange();

		return true;
	}

	public onCharacterListChange(): void {
		for (const connection of this.associatedConnections.clients) {
			// Only send updates to connections that can see the list (don't have character selected)
			if (!connection.character) {
				connection.sendMessage('somethingChanged', { changes: ['characterList'] });
			}
		}
		this.contacts.updateStatus();
	}

	public onAccountInfoChange(): void {
		// Update connected clients
		for (const connection of this.associatedConnections.clients) {
			connection.sendConnectionStateUpdate();
		}
		// Update shards
		for (const character of this.characters.values()) {
			character.onAccountInfoChange();
		}
		// Update friends
		this.contacts.updateStatus();
	}

	public hasCharacter(id: CharacterId, checkNotConnected?: true): boolean {
		const character = this.characters.get(id);

		return character != null && (!checkNotConnected || !character.isInUse());
	}

	//#endregion

	//#region Spaces

	public get spaceOwnershipLimit(): number {
		return LIMIT_SPACE_OWNED_COUNT;
	}

	//#endregion

	//#region Cleanup

	/**
	 * Cleanup the account, disconnecting characters and cleaning up tokens.
	 */
	public doCleanup(): Promise<void> {
		return this.cleanupInterval.immediate();
	}

	private async _doCleanupAsync(): Promise<void> {
		this.secure.cleanupTokens();

		for (const info of this.characters.values()) {
			const character = info.loadedCharacter;
			if (character != null && character.toBeDisconnected) {
				await character.disconnect();
			}
		}
	}

	// #endregion
}

export async function CreateAccountData(username: string, displayName: string, password: string, email: string, activated: boolean = false): Promise<DatabaseAccountWithSecure> {
	return {
		username,
		id: -1, // generated by database
		created: Date.now(),
		profileDescription: '',
		settings: {
			displayName,
		},
		settingsCooldowns: {},
		storedOutfits: [],
		storedPosePresets: [],
		secure: await GenerateAccountSecureData(password, email, activated),
	};
}

export function GetDirectMessageId(a: Account, b: Account): DirectMessageAccounts {
	const [x, y] = a.id < b.id ? [a, b] : [b, a];
	return `${x.id}-${y.id}`;
}
