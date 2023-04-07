import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { CreateAccountData } from '../account/account';
import { AccountId, CharacterId, GetLogger, ICharacterData, ICharacterSelfInfoUpdate, IChatRoomData, IChatRoomDataDirectoryUpdate, IChatRoomDataShardUpdate, IChatRoomDirectoryData, IDirectoryAccountSettings, IDirectoryDirectMessage, IDirectoryDirectMessageInfo, PASSWORD_PREHASH_SALT, RoomId } from 'pandora-common';
import { CreateCharacter, CreateChatRoom, IChatRoomCreationData } from './dbHelper';

import _ from 'lodash';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

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
	private chatroomDb: Map<RoomId, IChatRoomData> = new Map();
	private configDb: Map<DatabaseConfigType, DatabaseConfigData<DatabaseConfigType>> = new Map();
	private directMessagesDb: Map<DirectMessageAccounts, IDirectoryDirectMessage[]> = new Map();
	private _nextAccountId = 1;
	private _nextCharacterId = 1;
	private get accountDbView(): DatabaseAccountWithSecure[] {
		return Array.from(this.accountDb.values());
	}

	constructor() {
		logger.info('Initialized mock database');
	}

	public async init(addTestAccounts?: false): Promise<this> {
		if (addTestAccounts === false)
			return this;

		await this.createAccount(await CreateAccountData(
			'test',
			PrehashPassword('test'),
			'test@project-pandora.com',
			true,
		));
		await this.createAccount(await CreateAccountData(
			'testinactive',
			PrehashPassword('test'),
			'testinactive@project-pandora.com',
			false,
		));
		return this;
	}

	public get nextAccountId(): number {
		return this._nextAccountId;
	}

	public get nextCharacterId(): number {
		return this._nextCharacterId;
	}

	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	public getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	public getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
		username = username.toLowerCase();
		const acc = this.accountDbView.find((dbAccount) => dbAccount.username.toLowerCase() === username);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Get account by email hash
	 * @param emailHash - Email hash to search for
	 */
	public getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === emailHash);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	public createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		const acc = _.cloneDeep(data);
		const conflict = this.accountDbView.find(
			(dbAccount) =>
				dbAccount.username.toLowerCase() === acc.username.toLowerCase() ||
				dbAccount.secure.emailHash === acc.secure.emailHash,
		);
		if (conflict) {
			return Promise.resolve(conflict.username.toLowerCase() === acc.username.toLowerCase() ? 'usernameTaken' : 'emailTaken');
		}
		acc.id = this._nextAccountId++;
		this.accountDb.add(acc);
		return Promise.resolve(_.cloneDeep(acc));
	}

	public updateAccountSettings(id: number, data: IDirectoryAccountSettings): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.settings = _.cloneDeep(data);
		return Promise.resolve();
	}

	public setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.secure = _.cloneDeep(data);
		return Promise.resolve();
	}

	public setAccountSecureGitHub(id: number, data: DatabaseAccountSecure['github']): Promise<boolean> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve(false);

		if (data && this.accountDbView.find((dbAccount) => dbAccount.secure.github?.id === data.id))
			return Promise.resolve(false);

		acc.secure.github = _.cloneDeep(data);
		return Promise.resolve(true);
	}

	public setAccountRoles(id: number, data?: DatabaseAccountWithSecure['roles']): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.roles = _.cloneDeep(data);
		return Promise.resolve();
	}

	public createCharacter(accountId: number): Promise<ICharacterSelfInfoDb> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.reject(new Error('Account not found'));

		const [info, char] = CreateCharacter(accountId, `c${this._nextCharacterId++}`);

		acc.characters.push(info);
		this.characterDb.set(char.id, char);
		return Promise.resolve(_.cloneDeep(info));
	}

	public finalizeCharacter(accountId: number, characterId: CharacterId): Promise<ICharacterData | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve(null);

		const info = acc.characters.find((c) => c.id === characterId);

		if (!info)
			return Promise.resolve(null);

		const char = this.characterDb.get(info.id);
		if (!char?.inCreation)
			return Promise.resolve(null);

		char.inCreation = undefined;
		char.created = Date.now();

		info.inCreation = undefined;
		info.name = char.name;

		return Promise.resolve(_.cloneDeep(char));
	}

	public updateCharacter(accountId: number, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve(null);

		const info = acc.characters.find((dbChar) => dbChar.id === id);
		if (!info)
			return Promise.resolve(null);

		if (data.preview)
			info.preview = data.preview;

		return Promise.resolve(_.cloneDeep(info));
	}

	public deleteCharacter(accountId: number, characterId: CharacterId): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve();

		const info = acc.characters.find((char) => char.id === characterId);
		if (!info)
			return Promise.resolve();

		acc.characters = acc.characters.filter((char) => char.id !== characterId);
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

	//#region ChatRoom

	public getChatRoomsWithOwner(account: AccountId): Promise<IChatRoomDirectoryData[]> {
		return Promise.resolve(
			Array.from(this.chatroomDb.values())
				.filter((room) => room.owners.includes(account))
				.map((room) => _.pick(room, ['id', 'config', 'owners'])),
		);
	}

	public getChatRoomsWithOwnerOrAdmin(account: AccountId): Promise<IChatRoomDirectoryData[]> {
		return Promise.resolve(
			Array.from(this.chatroomDb.values())
				.filter((room) => room.owners.includes(account) || room.config.admin.includes(account))
				.map((room) => _.pick(room, ['id', 'config', 'owners'])),
		);
	}

	public getChatRoomById(id: RoomId, accessId: string | null): Promise<IChatRoomData | null> {
		const room = this.chatroomDb.get(id);
		if (!room)
			return Promise.resolve(null);

		if ((accessId !== null) && (accessId !== room.accessId)) {
			return Promise.resolve(null);
		}
		return Promise.resolve(_.cloneDeep(room));
	}

	public createChatRoom(data: IChatRoomCreationData, id?: RoomId): Promise<IChatRoomData> {
		const room = CreateChatRoom(data, id);

		if (this.chatroomDb.has(room.id)) {
			return Promise.reject('Duplicate ID');
		}
		this.chatroomDb.set(room.id, room);
		return Promise.resolve(_.cloneDeep(room));
	}

	public updateChatRoom(id: RoomId, data: IChatRoomDataDirectoryUpdate & IChatRoomDataShardUpdate, accessId: string | null): Promise<boolean> {
		const room = _.cloneDeep(data);

		const info = this.chatroomDb.get(id);
		if (!info)
			return Promise.reject();

		if ((accessId !== null) && (accessId !== info.accessId)) {
			return Promise.resolve(false);
		}

		Object.assign(info, room);

		return Promise.resolve(true);
	}

	public deleteChatRoom(id: RoomId): Promise<void> {
		this.chatroomDb.delete(id);
		return Promise.resolve();
	}

	public setChatRoomAccess(id: RoomId): Promise<string | null> {
		const room = this.chatroomDb.get(id);
		if (!room)
			return Promise.resolve(null);

		room.accessId = nanoid(8);
		return Promise.resolve(room.accessId);
	}

	//#endregion

	public getDirectMessages(accounts: DirectMessageAccounts, limit: number, until?: number): Promise<IDirectoryDirectMessage[]> {
		const data = this.directMessagesDb.get(accounts);
		if (!data) {
			return Promise.resolve([]);
		}
		return Promise.resolve(data
			.sort((a, b) => b.time - a.time)
			.filter((msg) => !until || msg.time < until)
			.slice(0, limit)
			.map((msg) => _.cloneDeep(msg)));
	}

	public setDirectMessage(accounts: DirectMessageAccounts, message: IDirectoryDirectMessage): Promise<boolean> {
		let data = this.directMessagesDb.get(accounts);
		if (!data) {
			data = [];
			this.directMessagesDb.set(accounts, data);
		}
		if (message.edited === undefined) {
			data.push(message);
			return Promise.resolve(true);
		}
		if (message.content) {
			const msg = data.find((m) => m.time === message.time);
			if (!msg)
				return Promise.resolve(false);

			msg.content = message.content;
			msg.edited = message.edited;
			return Promise.resolve(true);
		}
		const index = data.findIndex((m) => m.time === message.time);
		if (index === -1)
			return Promise.resolve(false);

		data.splice(index, 1);
		return Promise.resolve(true);
	}

	public setDirectMessageInfo(accountId: number, directMessageInfo: IDirectoryDirectMessageInfo[]): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve();

		acc.directMessages = directMessageInfo;
		return Promise.resolve();
	}

	public getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null> {
		const char = this.characterDb.get(id);
		if (!char)
			return Promise.resolve(null);

		if (accessId === false)
			char.accessId = accessId = nanoid(8);
		else if (accessId !== char.accessId)
			return Promise.resolve(null);

		return Promise.resolve(_.cloneDeep(char));
	}

	public setCharacter({ id, accessId, ...data }: Partial<ICharacterData> & Pick<ICharacterData, 'id'>): Promise<boolean> {
		const char = this.characterDb.get(id);
		if (char?.accessId !== accessId)
			return Promise.resolve(false);

		_.assign(char, _.cloneDeep(data));
		return Promise.resolve(true);
	}

	public getConfig<T extends DatabaseConfigType>(type: T): Promise<null | DatabaseConfigData<T>> {
		const config = this.configDb.get(type);
		if (!config)
			return Promise.resolve(null);

		// @ts-expect-error data is unique to each config type
		return Promise.resolve(_.cloneDeep(config));
	}

	public setConfig<T extends DatabaseConfigType>(type: T, data: DatabaseConfigData<T>): Promise<void> {
		this.configDb.set(type, _.cloneDeep(data));
		return Promise.resolve();
	}
}
