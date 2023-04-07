import { CharacterId, DirectoryAccountSettingsSchema, ICharacterSelfInfo, IDirectoryAccountInfo, IDirectoryAccountSettings, IShardAccountDefinition, IsObject, ACCOUNT_SETTINGS_DEFAULT } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Character } from './character';
import { CHARACTER_LIMIT_NORMAL, ROOM_LIMIT_NORMAL } from '../config';
import AccountSecure, { GenerateAccountSecureData } from './accountSecure';
import { AccountRoles } from './accountRoles';
import { AccountDirectMessages } from './accountDirectMessages';
import type { ClientConnection } from '../networking/connection_client';

import _, { cloneDeep, omit } from 'lodash';

/** Currently logged in or recently used account */
export class Account {
	/** Time when this account was last used */
	public lastActivity: number;
	/** The account's saved data */
	public data: Omit<DatabaseAccount, 'secure' | 'characters'>;
	/** List of connections logged in as this account */
	public associatedConnections: Set<ClientConnection> = new Set();

	public readonly characters: Map<CharacterId, Character> = new Map();

	public readonly secure: AccountSecure;
	public readonly roles: AccountRoles;
	public readonly directMessages: AccountDirectMessages;

	public get id(): number {
		return this.data.id;
	}

	public get username(): string {
		return this.data.username;
	}

	constructor(data: DatabaseAccountWithSecure) {
		this.lastActivity = Date.now();
		// Shallow copy to preserve received data when cleaning up secure
		this.data = omit(data, 'secure', 'roles', 'characters');

		// Init subsystems
		this.secure = new AccountSecure(this, data.secure);
		this.roles = new AccountRoles(this, data.roles);
		this.directMessages = new AccountDirectMessages(this, data.directMessages);

		// Init characters
		for (const characterData of data.characters) {
			this.characters.set(characterData.id, new Character(characterData, this));
		}

		// Settings migration
		if (!IsObject(this.data.settings)) {
			this.data.settings = cloneDeep(ACCOUNT_SETTINGS_DEFAULT);
		} else {
			const s = this.data.settings as Record<string, unknown>;
			for (const [key, shape] of Object.entries(DirectoryAccountSettingsSchema.shape)) {
				if (!shape.safeParse(s[key]).success) {
					s[key] = cloneDeep((ACCOUNT_SETTINGS_DEFAULT as Record<string, unknown>)[key]);
				}
			}
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
		return this.associatedConnections.size > 0 || Array.from(this.characters.values()).some((c) => c.isInUse());
	}

	/** Build account part of `connectionState` update message for connection */
	public getAccountInfo(): IDirectoryAccountInfo {
		return {
			id: this.data.id,
			username: this.data.username,
			created: this.data.created,
			github: this.secure.getGitHubStatus(),
			roles: this.roles.getSelfInfo(),
			roomOwnershipLimit: this.roomOwnershipLimit,
			settings: _.cloneDeep(this.data.settings),
			cryptoKey: this.secure.getCryptoKey(),
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
			settings.visibleRoles = settings.visibleRoles.filter((role) => this.roles.isAuthorized(role));
		}

		this.data.settings = { ...this.data.settings, ...settings };

		await GetDatabase().updateAccountSettings(this.data.id, this.data.settings);
		this.onAccountInfoChange();
	}

	//#region Character

	public listCharacters(): ICharacterSelfInfo[] {
		return Array.from(this.characters.values()).map((character) => ({
			...character.data,
			state: character.getInfoState(),
		}));
	}

	public async createCharacter(): Promise<Character | null> {
		if (this.characters.size > CHARACTER_LIMIT_NORMAL || Array.from(this.characters.values()).some((i) => i.inCreation))
			return null;

		const info = await GetDatabase().createCharacter(this.data.id);
		const character = new Character(info, this);
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
		for (const connection of this.associatedConnections.values()) {
			// Only send updates to connections that can see the list (don't have character selected)
			if (!connection.character) {
				connection.sendMessage('somethingChanged', { changes: ['characterList'] });
			}
		}
	}

	public onAccountInfoChange(): void {
		// Update connected clients
		for (const connection of this.associatedConnections.values()) {
			connection.sendConnectionStateUpdate();
		}
		// Update shards
		for (const character of this.characters.values()) {
			character.onAccountInfoChange();
		}
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
		secure: await GenerateAccountSecureData(password, email, activated),
		characters: [],
		settings: cloneDeep(ACCOUNT_SETTINGS_DEFAULT),
	};
}

export function GetDirectMessageId(a: Account, b: Account): DirectMessageAccounts {
	const [x, y] = a.id < b.id ? [a, b] : [b, a];
	return `${x.id}-${y.id}`;
}
