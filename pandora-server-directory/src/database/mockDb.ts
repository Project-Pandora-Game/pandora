import { createHash } from 'crypto';
import { assign, cloneDeep, pick, remove } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	AccountId,
	ArrayToRecordKeys,
	CHARACTER_SHARD_VISIBLE_PROPERTIES,
	CharacterId,
	GetLogger,
	ICharacterData,
	ICharacterDataDirectoryUpdate,
	ICharacterDataShardUpdate,
	PASSWORD_PREHASH_SALT,
	SPACE_DIRECTORY_PROPERTIES,
	SpaceData,
	SpaceDataDirectoryUpdate,
	SpaceDataShardUpdate,
	SpaceDirectoryData,
	SpaceId,
	type ICharacterDataShard,
} from 'pandora-common';
import { CreateAccountData } from '../account/account.ts';
import type { PandoraDatabase } from './databaseProvider.ts';
import {
	DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES,
	DatabaseAccountContact,
	DatabaseAccountContactType,
	DatabaseAccountSchema,
	DatabaseAccountSecure,
	DatabaseAccountUpdate,
	DatabaseAccountWithSecure,
	DatabaseConfigData,
	DatabaseConfigType,
	DatabaseDirectMessageInfo,
	DirectMessageAccounts,
	type DatabaseCharacterSelfInfo,
	type DatabaseConfigCreationCounters,
	type DatabaseDirectMessage,
	type DatabaseDirectMessageAccounts,
} from './databaseStructure.ts';
import { CreateCharacter, CreateSpace, SpaceCreationData } from './dbHelper.ts';

function HashSHA512Base64(text: string): string {
	return createHash('sha512').update(text, 'utf-8').digest('base64');
}

export function PrehashPassword(password: string): string {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

const logger = GetLogger('db');

export class MockDatabase implements PandoraDatabase {
	private accountDb: Set<DatabaseAccountWithSecure> = new Set();
	private characterDb: Map<CharacterId, ICharacterData> = new Map();
	private spacesDb: Map<SpaceId, SpaceData> = new Map();
	private configDb: Map<DatabaseConfigType, DatabaseConfigData<DatabaseConfigType>> = new Map();
	private directMessagesDb: Map<DirectMessageAccounts, DatabaseDirectMessageAccounts> = new Map();
	private accountContactDb: DatabaseAccountContact[] = [];
	private _creationCounters: DatabaseConfigCreationCounters = {
		nextAccountId: 1,
		nextCharacterId: 1,
	};
	private get accountDbView(): DatabaseAccountWithSecure[] {
		return Array.from(this.accountDb.values());
	}

	constructor() {
		logger.info('Initialized mock database');
	}

	public async addTestAccounts() {
		await this.createAccount(await CreateAccountData(
			'test',
			'test',
			PrehashPassword('test'),
			'test@project-pandora.com',
			true,
		));
		await this.createAccount(await CreateAccountData(
			'testinactive',
			'testinactive',
			PrehashPassword('test'),
			'testinactive@project-pandora.com',
			false,
		));
	}

	public get nextAccountId(): number {
		return this._creationCounters.nextAccountId;
	}

	public get nextCharacterId(): number {
		return this._creationCounters.nextCharacterId;
	}

	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	public getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		return Promise.resolve(cloneDeep(acc ?? null));
	}

	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	public getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
		username = username.toLowerCase();
		const acc = this.accountDbView.find((dbAccount) => dbAccount.username.toLowerCase() === username);
		return Promise.resolve(cloneDeep(acc ?? null));
	}

	/**
	 * Get account by email hash
	 * @param emailHash - Email hash to search for
	 */
	public getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === emailHash);
		return Promise.resolve(cloneDeep(acc ?? null));
	}

	public createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		const acc = cloneDeep(data);
		const conflict = this.accountDbView.find(
			(dbAccount) =>
				dbAccount.username.toLowerCase() === acc.username.toLowerCase() ||
				dbAccount.secure.emailHash === acc.secure.emailHash,
		);
		if (conflict) {
			return Promise.resolve(conflict.username.toLowerCase() === acc.username.toLowerCase() ? 'usernameTaken' : 'emailTaken');
		}
		acc.id = this._creationCounters.nextAccountId++;
		this.accountDb.add(acc);
		return Promise.resolve(cloneDeep(acc));
	}

	public updateAccountEmailHash(id: AccountId, emailHash: string): Promise<'ok' | 'notFound' | 'emailTaken'> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve('notFound');

		if (this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === emailHash))
			return Promise.resolve('emailTaken');

		acc.secure.emailHash = emailHash;
		return Promise.resolve('ok');
	}

	public updateAccountData(id: AccountId, data: DatabaseAccountUpdate): Promise<void> {
		data = DatabaseAccountSchema
			.pick(ArrayToRecordKeys(DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, true))
			.partial()
			.strict()
			.parse(cloneDeep(data));

		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		Object.assign(acc, data);
		return Promise.resolve();
	}

	public setAccountSecure(id: AccountId, data: DatabaseAccountSecure): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.secure = cloneDeep(data);
		return Promise.resolve();
	}

	public setAccountSecureGitHub(id: AccountId, data: DatabaseAccountSecure['github']): Promise<boolean> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve(false);

		if (data && this.accountDbView.find((dbAccount) => dbAccount.secure.github?.id === data.id))
			return Promise.resolve(false);

		acc.secure.github = cloneDeep(data);
		return Promise.resolve(true);
	}

	public queryAccountDisplayNames(query: AccountId[]): Promise<Record<AccountId, string>> {
		const result: Record<AccountId, string> = {};
		for (const acc of this.accountDbView) {
			if (query.includes(acc.id))
				result[acc.id] = acc.settings.displayName ?? acc.username;
		}
		return Promise.resolve(result);
	}

	public getCharactersForAccount(accountId: number): Promise<DatabaseCharacterSelfInfo[]> {
		return Promise.resolve(
			Array.from(this.characterDb.values())
				.filter((c) => c.accountId === accountId)
				.map((c): DatabaseCharacterSelfInfo => ({
					id: c.id,
					name: c.name,
					preview: c.preview,
					currentSpace: c.currentSpace,
					inCreation: c.inCreation,
				})),
		);
	}

	public createCharacter(accountId: AccountId): Promise<DatabaseCharacterSelfInfo> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.reject(new Error('Account not found'));

		const [info, char] = CreateCharacter(accountId, `c${this._creationCounters.nextCharacterId++}`);

		this.characterDb.set(char.id, char);
		return Promise.resolve(cloneDeep(info));
	}

	public finalizeCharacter(accountId: AccountId, characterId: CharacterId): Promise<Pick<ICharacterData, 'id' | 'name' | 'created'> | null> {
		const char = this.characterDb.get(characterId);
		if (char?.accountId !== accountId || !char?.inCreation)
			return Promise.resolve(null);

		char.inCreation = undefined;
		char.created = Date.now();

		return Promise.resolve(pick(cloneDeep(char), ['id', 'name', 'created']));
	}

	public updateCharacter(id: CharacterId, data: ICharacterDataDirectoryUpdate & ICharacterDataShardUpdate, accessId: string | null): Promise<boolean> {
		const char = this.characterDb.get(id);
		if (char == null || accessId !== null && char.accessId !== accessId)
			return Promise.resolve(false);

		assign(char, cloneDeep(data));
		return Promise.resolve(true);
	}

	public deleteCharacter(accountId: AccountId, characterId: CharacterId): Promise<void> {
		const character = this.characterDb.get(characterId);

		if (character?.accountId !== accountId)
			return Promise.resolve();

		this.characterDb.delete(characterId);
		return Promise.resolve();
	}

	public setCharacterAccess(id: CharacterId): Promise<string | null> {
		const char = this.characterDb.get(id);
		if (!char)
			return Promise.resolve(null);

		char.accessId = nanoid(8);
		return Promise.resolve(char.accessId);
	}

	public getCharactersInSpace(spaceId: SpaceId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]> {
		return Promise.resolve(
			Array.from(this.characterDb.values())
				.filter((c) => c.currentSpace === spaceId)
				.map((c): {
					accountId: AccountId;
					characterId: CharacterId;
				} => ({
					characterId: c.id,
					accountId: c.accountId,
				})),
		);
	}

	//#region Spaces

	public getSpacesWithOwner(account: AccountId): Promise<SpaceDirectoryData[]> {
		return Promise.resolve(
			Array.from(this.spacesDb.values())
				.filter((space) => space.owners.includes(account))
				.map((space) => pick(space, SPACE_DIRECTORY_PROPERTIES)),
		);
	}

	public getSpacesWithOwnerOrAdminOrAllowed(account: AccountId): Promise<SpaceDirectoryData[]> {
		return Promise.resolve(
			Array.from(this.spacesDb.values())
				.filter((space) => space.owners.includes(account) || space.config.admin.includes(account) || space.config.allow.includes(account))
				.map((space) => pick(space, SPACE_DIRECTORY_PROPERTIES)),
		);
	}

	public getSpaceById(id: SpaceId, accessId: string | null): Promise<SpaceData | null> {
		const space = this.spacesDb.get(id);
		if (!space)
			return Promise.resolve(null);

		if ((accessId !== null) && (accessId !== space.accessId)) {
			return Promise.resolve(null);
		}
		return Promise.resolve(cloneDeep(space));
	}

	public createSpace(data: SpaceCreationData, id?: SpaceId): Promise<SpaceData> {
		const space = CreateSpace(data, id);

		if (this.spacesDb.has(space.id)) {
			return Promise.reject(new Error('Duplicate ID'));
		}
		this.spacesDb.set(space.id, space);
		return Promise.resolve(cloneDeep(space));
	}

	public updateSpace(id: SpaceId, data: SpaceDataDirectoryUpdate & SpaceDataShardUpdate, accessId: string | null): Promise<boolean> {
		const space = cloneDeep(data);

		const info = this.spacesDb.get(id);
		if (!info)
			return Promise.reject(new Error('Unknown space'));

		if ((accessId !== null) && (accessId !== info.accessId)) {
			return Promise.resolve(false);
		}

		Object.assign(info, space);

		return Promise.resolve(true);
	}

	public deleteSpace(id: SpaceId): Promise<void> {
		this.spacesDb.delete(id);
		return Promise.resolve();
	}

	public setSpaceAccessId(id: SpaceId): Promise<string | null> {
		const space = this.spacesDb.get(id);
		if (!space)
			return Promise.resolve(null);

		space.accessId = nanoid(8);
		return Promise.resolve(space.accessId);
	}

	//#endregion

	public getDirectMessages(accounts: DirectMessageAccounts): Promise<DatabaseDirectMessageAccounts | null> {
		const data = this.directMessagesDb.get(accounts);
		return Promise.resolve(data ?? null);
	}

	public setDirectMessage(accounts: DirectMessageAccounts, keyHash: string, message: DatabaseDirectMessage, maxCount: number): Promise<boolean> {
		const data = this.directMessagesDb.get(accounts);
		if (!data) {
			if (message.edited != null)
				return Promise.resolve(false);

			this.directMessagesDb.set(accounts, {
				accounts,
				keyHash,
				messages: [message],
			});
			return Promise.resolve(true);
		}

		if (data.keyHash !== keyHash) {
			data.keyHash = keyHash;
			data.messages = [];
		}

		if (message.edited != null) {
			const index = data.messages.findIndex((msg) => msg.time === message.time);
			if (index < 0)
				return Promise.resolve(false);

			if (message.content.length === 0) {
				data.messages.splice(index, 1);
			} else {
				data.messages[index] = message;
			}
		} else {
			data.messages.push(message);
			data.messages = data.messages.slice(-maxCount);
		}
		return Promise.resolve(true);
	}

	public setDirectMessageInfo(accountId: number, directMessageInfo: DatabaseDirectMessageInfo[]): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve();

		acc.directMessages = directMessageInfo;
		return Promise.resolve();
	}

	public getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterDataShard | null> {
		const char = this.characterDb.get(id);
		if (!char)
			return Promise.resolve(null);

		if (accessId === false)
			char.accessId = accessId = nanoid(8);
		else if (accessId !== char.accessId)
			return Promise.resolve(null);

		return Promise.resolve(pick(cloneDeep(char), CHARACTER_SHARD_VISIBLE_PROPERTIES));
	}

	public getAccountContacts(accountId: AccountId): Promise<DatabaseAccountContact[]> {
		return Promise.resolve(this.accountContactDb
			.filter((rel) => rel.accounts.includes(accountId))
			.map((rel) => cloneDeep(rel)));
	}

	public setAccountContact(accountIdA: AccountId, accountIdB: AccountId, data: DatabaseAccountContactType): Promise<DatabaseAccountContact> {
		const newData: DatabaseAccountContact = { accounts: [accountIdA, accountIdB], updated: Date.now(), contact: cloneDeep(data) };
		const index = this.accountContactDb.findIndex((rel) => rel.accounts.includes(accountIdA) && rel.accounts.includes(accountIdB));
		if (index < 0) {
			this.accountContactDb.push(newData);
		} else {
			this.accountContactDb[index] = newData;
		}
		return Promise.resolve(cloneDeep(newData));
	}

	public removeAccountContact(accountIdA: number, accountIdB: number): Promise<void> {
		remove(this.accountContactDb, (rel) => rel.accounts.includes(accountIdA) && rel.accounts.includes(accountIdB));
		return Promise.resolve();
	}

	public getConfig<T extends DatabaseConfigType>(type: T): Promise<null | DatabaseConfigData<T>> {
		const config = this.configDb.get(type);
		if (!config)
			return Promise.resolve(null);

		// @ts-expect-error data is unique to each config type
		return Promise.resolve(cloneDeep(config));
	}

	public setConfig<T extends DatabaseConfigType>(type: T, data: DatabaseConfigData<T>): Promise<void> {
		this.configDb.set(type, cloneDeep(data));
		return Promise.resolve();
	}
}
