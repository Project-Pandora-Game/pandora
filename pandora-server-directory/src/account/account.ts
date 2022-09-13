import { CharacterId, ICharacterData, ICharacterSelfInfo, ICharacterSelfInfoUpdate, IDirectoryAccountInfo, IDirectoryAccountSettings, IShardAccountDefinition } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import type { IConnectionClient } from '../networking/common';
import { Character } from './character';
import { CHARACTER_LIMIT_NORMAL } from '../config';
import AccountSecure, { GenerateAccountSecureData } from './accountSecure';
import { AccountRoles } from './accountRoles';

import _ from 'lodash';

/** Currently logged in or recently used account */
export class Account {
	/** Time when this account was last used */
	public lastActivity: number;
	/** The account's saved data */
	public data: Omit<DatabaseAccount, 'secure'>;
	/** List of connections logged in as this account */
	public associatedConnections: Set<IConnectionClient> = new Set();

	readonly characters: Map<CharacterId, Character> = new Map();

	public readonly secure: AccountSecure;
	public readonly roles: AccountRoles;

	public get id(): number {
		return this.data.id;
	}

	public get username(): string {
		return this.data.username;
	}

	constructor(data: DatabaseAccountWithSecure) {
		this.lastActivity = Date.now();
		this.secure = new AccountSecure(this, data.secure);
		this.roles = new AccountRoles(this, data.roles);
		// Shallow copy to preserve received data when cleaning up secure
		const cleanData: DatabaseAccount = { ...data };
		delete cleanData.secure;
		delete cleanData.roles;
		this.data = cleanData;
		for (const characterData of this.data.characters) {
			this.characters.set(characterData.id, new Character(characterData, this));
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
			settings: _.cloneDeep(this.data.settings),
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
		return this.data.characters.map((info) => ({
			...info,
			state: this.getCharacterInfoState(info.id),
		}));
	}

	public async createCharacter(): Promise<Character | null> {
		if (this.data.characters.length > CHARACTER_LIMIT_NORMAL || this.data.characters.some((i) => i.inCreation))
			return null;

		const info = await GetDatabase().createCharacter(this.data.id);
		this.data.characters.push(info);
		const character = new Character(info, this);
		this.characters.set(info.id, character);

		this.onCharacterListChange();

		return character;
	}

	public async finishCharacterCreation(id: CharacterId): Promise<ICharacterData | null> {
		const info = this.data.characters[this.data.characters.length - 1];
		if (info.id !== id || !info.inCreation)
			return null;

		const char = await GetDatabase().finalizeCharacter(this.data.id);
		if (!char)
			return null;

		info.name = char.name;
		info.inCreation = undefined;

		this.onCharacterListChange();

		return char;
	}

	public async updateCharacter(update: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfo | null> {
		if (!this.hasCharacter(update.id))
			return null;

		const info = await GetDatabase().updateCharacter(this.data.id, update);
		if (!info)
			return null;

		const index = this.data.characters.findIndex((char) => char.id === info.id);
		this.data.characters[index] = info;

		return ({
			...info,
			state: this.getCharacterInfoState(info.id),
		});
	}

	public async deleteCharacter(id: CharacterId): Promise<boolean> {
		const character = this.characters.get(id);
		if (!character || character.isInUse())
			return false;

		this.data.characters.splice(character.accountCharacterIndex, 1);
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
			character.assignedShard?.update('characters');
		}
	}

	public hasCharacter(id: CharacterId, checkNotConnected?: true): boolean {
		const character = this.characters.get(id);

		return character != null && (!checkNotConnected || !character.isInUse());
	}

	private getCharacterInfoState(id: CharacterId): string {
		const character = this.characters.get(id);
		if (!character)
			return '';

		if (character.isInUse())
			return 'connected';

		if (this.data.characters[character.accountCharacterIndex].inCreation)
			return 'inCreation';

		return '';
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
		settings: {
			visibleRoles: [],
		},
	};
}
