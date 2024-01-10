import { CharacterId, ICharacterSelfInfo, IDirectoryAccountInfo, IDirectoryAccountSettings, IShardAccountDefinition, ACCOUNT_SETTINGS_DEFAULT, AccountId, ServerRoom, IDirectoryClient, Assert, OutfitMeasureCost, LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS, AsyncSynchronized, AssetFrameworkOutfitWithId, AccountPublicInfo, KnownObject, ACCOUNT_SETTINGS_LIMITED_LIMITS } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { CharacterInfo } from './character';
import { ENV } from '../config';
const { CHARACTER_LIMIT_NORMAL, ROOM_LIMIT_NORMAL } = ENV;
import AccountSecure, { GenerateAccountSecureData } from './accountSecure';
import { AccountRoles } from './accountRoles';
import { AccountDirectMessages } from './accountDirectMessages';
import type { ClientConnection } from '../networking/connection_client';
import { AccountContacts } from './accountContacts';
import { DatabaseAccount, DatabaseAccountWithSecure, DirectMessageAccounts } from '../database/databaseStructure';

import _, { cloneDeep, omit, uniq } from 'lodash';

/** Currently logged in or recently used account */
export class Account {
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

	constructor(data: DatabaseAccountWithSecure) {
		this.lastActivity = Date.now();
		// Shallow copy to preserve received data when cleaning up secure
		this.data = omit(data, 'secure', 'roles', 'characters');

		// Init subsystems
		this.secure = new AccountSecure(this, data.secure);
		this.roles = new AccountRoles(this, data.roles);
		this.directMessages = new AccountDirectMessages(this, data.directMessages);
		this.contacts = new AccountContacts(this);

		// Init characters
		for (const characterData of data.characters) {
			this.characters.set(characterData.id, new CharacterInfo(characterData, this));
		}
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
			roomOwnershipLimit: this.roomOwnershipLimit,
			settings: _.cloneDeep(this.data.settings),
			settingsCooldowns: _.cloneDeep(this.data.settingsCooldowns),
			cryptoKey: this.secure.getCryptoKey(),
		};
	}

	/** The info that is visible to public (with some limitations) */
	public getAccountPublicInfo(): AccountPublicInfo {
		return {
			id: this.data.id,
			displayName: this.displayName,
			labelColor: this.data.settings.labelColor,
			created: this.data.created,
			visibleRoles: uniq(this.data.settings.visibleRoles.filter((role) => this.roles.isAuthorized(role))),
			profileDescription: this.data.profileDescription,
		};
	}

	public getShardAccountDefinition(): IShardAccountDefinition {
		return {
			id: this.id,
			roles: this.roles.getSelfInfo(),
		};
	}

	public async changeSettings(settings: Partial<IDirectoryAccountSettings>): Promise<void> {
		if (settings.visibleRoles) {
			settings.visibleRoles = uniq(settings.visibleRoles.filter((role) => this.roles.isAuthorized(role)));
		}

		const db = GetDatabase();
		const update: Parameters<(typeof db)['updateAccountData']>['1'] = {};

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
		if (!Number.isInteger(totalCost) || totalCost > LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS) {
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

	public listCharacters(): ICharacterSelfInfo[] {
		return Array.from(this.characters.values()).map((character) => ({
			...character.data,
			state: character.getInfoState(),
		}));
	}

	public async createCharacter(): Promise<CharacterInfo | null> {
		if (this.characters.size > CHARACTER_LIMIT_NORMAL || Array.from(this.characters.values()).some((i) => i.inCreation))
			return null;

		const info = await GetDatabase().createCharacter(this.data.id);
		const character = new CharacterInfo(info, this);
		this.characters.set(info.id, character);

		this.onCharacterListChange();

		return character;
	}

	public async deleteCharacter(id: CharacterId): Promise<boolean> {
		const character = this.characters.get(id);
		if (!character || character.isInUse())
			return false;

		this.characters.delete(id);
		await GetDatabase().deleteCharacter(this.data.id, id);

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

	//#region Rooms

	public get roomOwnershipLimit(): number {
		return ROOM_LIMIT_NORMAL;
	}

	//#endregion
}

export async function CreateAccountData(username: string, password: string, email: string, activated: boolean = false): Promise<DatabaseAccountWithSecure> {
	return {
		username,
		id: -1, // generated by database
		created: Date.now(),
		profileDescription: '',
		characters: [],
		settings: cloneDeep(ACCOUNT_SETTINGS_DEFAULT),
		settingsCooldowns: {},
		storedOutfits: [],
		secure: await GenerateAccountSecureData(password, email, activated),
	};
}

export function GetDirectMessageId(a: Account, b: Account): DirectMessageAccounts {
	const [x, y] = a.id < b.id ? [a, b] : [b, a];
	return `${x.id}-${y.id}`;
}
