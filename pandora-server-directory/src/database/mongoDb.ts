import { CharacterId, ICharacterData, ICharacterSelfInfoUpdate, GetLogger, IDirectoryAccountSettings, IDirectoryDirectMessageInfo, IDirectoryDirectMessage } from 'pandora-common';
import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { DATABASE_URL, DATABASE_NAME } from '../config';
import { CreateCharacter } from './dbHelper';

import AsyncLock from 'async-lock';
import { type MatchKeysAndValues, MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { nanoid } from 'nanoid';

const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';
const CHARACTERS_COLLECTION_NAME = 'characters';
const DIRECT_MESSAGES_COLLECTION_NAME = 'directMessages';

export default class MongoDatabase implements PandoraDatabase {
	private readonly _lock: AsyncLock;
	private readonly _url: string;
	private _client!: MongoClient;
	private _inMemoryServer!: MongoMemoryServer;
	private _db!: Db;
	private _accounts!: Collection<DatabaseAccountWithSecure>;
	private _characters!: Collection<Omit<ICharacterData, 'id'> & { id: number; }>;
	private _config!: Collection<DatabaseConfig>;
	private _directMessages!: Collection<IDirectoryDirectMessage & { accounts: DirectMessageAccounts; }>;
	private _nextAccountId = 1;
	private _nextCharacterId = 1;

	constructor(url: string = DATABASE_URL) {
		this._lock = new AsyncLock();
		this._url = url;
	}

	public async init({
		inMemory,
		dbPath,
	}: {
		inMemory?: true;
		/** Requires `inMemory`, saves data into persistent directory */
		dbPath?: string;
	} = {}): Promise<this> {
		if (this._db) {
			throw new Error('Database already initialized');
		}

		if (inMemory) {
			this._inMemoryServer = await CreateInMemoryMongo({ dbPath });
			this._client = new MongoClient(this._inMemoryServer.getUri());
		} else {
			this._client = new MongoClient(this._url);
		}

		// if connection fails, error is thrown, application will exit
		await this._client.connect();

		this._db = this._client.db(DATABASE_NAME);

		//#region Accounts
		this._accounts = this._db.collection(ACCOUNTS_COLLECTION_NAME);

		await this._accounts.createIndexes([
			{ key: { id: 1 } },
			{ key: { username: 1 } },
			{ key: { 'secure.emailHash': 1 } },
			{ key: { 'secure.github.id': 1 } },
		], { unique: true });

		const [maxAccountId] = await this._accounts.find().sort({ id: -1 }).limit(1).toArray();
		this._nextAccountId = maxAccountId ? maxAccountId.id + 1 : 1;
		//#endregion

		//#region Characters
		this._characters = this._db.collection(CHARACTERS_COLLECTION_NAME);

		await this._characters.createIndexes([
			{ key: { id: 1 } },
		], { unique: true });

		const [maxCharId] = await this._characters.find().sort({ id: -1 }).limit(1).toArray();
		this._nextCharacterId = maxCharId ? maxCharId.id + 1 : 1;
		//#endregion

		//#region Config
		this._config = this._db.collection('config');

		await this._config.createIndexes([
			{ key: { type: 1 } },
		], { unique: true });
		//#endregion

		//#region DirectMessages
		this._directMessages = this._db.collection(DIRECT_MESSAGES_COLLECTION_NAME);

		await this._directMessages.createIndexes([
			{ key: { accounts: 1 } },
			{ key: { time: 1 } },
		], { unique: false });
		//#endregion

		logger.info(`Initialized ${this._inMemoryServer ? 'In-Memory-' : ''}MongoDB database`);

		if (!inMemory || dbPath) {
			await this._doMigrations();
		}

		return this;
	}

	public async close(): Promise<void> {
		await this._client.close();
		if (this._inMemoryServer) {
			await this._inMemoryServer.stop();
		}
	}

	public get nextAccountId(): number {
		return this._nextAccountId;
	}

	public get nextCharacterId(): number {
		return this._nextCharacterId;
	}

	public async getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ id });
	}

	public async getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ username });
	}

	public async getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ 'secure.emailHash': emailHash });
	}

	public async createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		return await this._lock.acquire('createAccount', async () => {

			const existingAccount = await this._accounts.findOne({ $or: [{ username: data.username }, { 'secure.emailHash': data.secure.emailHash }] });
			if (existingAccount)
				return existingAccount.username === data.username ? 'usernameTaken' : 'emailTaken';

			data.id = this._nextAccountId++;
			await this._accounts.insertOne(data);

			return await this.getAccountById(data.id) as DatabaseAccountWithSecure;
		});
	}

	public async updateAccountSettings(id: number, data: IDirectoryAccountSettings): Promise<void> {
		await this._accounts.updateOne({ id }, { $set: { settings: data } });
	}

	public async setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		await this._accounts.updateOne({ id }, { $set: { secure: data } });
	}

	public async setAccountSecureGitHub(id: number, data: DatabaseAccountSecure['github']): Promise<boolean> {
		const result = await this._accounts.findOneAndUpdate({ id }, { $set: { 'secure.github': data } }, { returnDocument: 'after' });
		if (!result.value)
			return false;

		if (data === undefined)
			return result.value.secure.github === undefined;

		return data.date === result.value.secure.github?.date;
	}

	public async setAccountRoles(id: number, data?: DatabaseAccountWithSecure['roles']): Promise<void> {
		if (data) {
			await this._accounts.updateOne({ id }, { $set: { roles: data } });
		} else {
			await this._accounts.updateOne({ id }, { $unset: { roles: '' } });
		}
	}

	public async createCharacter(accountId: number): Promise<ICharacterSelfInfoDb> {
		return await this._lock.acquire('createCharacter', async () => {
			if (!await this.getAccountById(accountId))
				throw new Error('Account not found');

			const [info, char] = CreateCharacter(accountId, this._nextCharacterId++);

			await this._accounts.updateOne({ id: accountId }, { $push: { characters: info } });
			await this._characters.insertOne(char);

			return info;
		});
	}

	public async finalizeCharacter(accountId: number): Promise<ICharacterData | null> {
		const acc = await this.getAccountById(accountId);
		if (!acc)
			return null;

		const info = acc.characters[acc.characters.length - 1];
		if (!info)
			return null;

		const result = await this._characters.findOneAndUpdate({ id: PlainId(info.id), inCreation: true }, { $set: { created: Date.now() }, $unset: { inCreation: '' } }, { returnDocument: 'after' });
		if (!result.value || result.value.inCreation !== undefined)
			return null;

		await this._accounts.updateOne({ 'id': accountId, 'characters.id': info.id }, { $set: { 'characters.$.name': result.value.name }, $unset: { 'characters.$.inCreation': '' } });

		return Id(result.value);
	}

	public async updateCharacter(accountId: number, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null> {
		// Transform the request
		const update: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(data)) {
			update[`characters.$.${k}`] = v;
		}
		const result = await this._accounts.findOneAndUpdate({ 'id': accountId, 'characters.id': id }, { $set: update as MatchKeysAndValues<DatabaseAccountWithSecure> }, { returnDocument: 'after' });
		return result.value?.characters.find((c) => c.id === id) ?? null;
	}

	public async deleteCharacter(accountId: number, characterId: CharacterId): Promise<void> {
		await this._characters.deleteOne({ id: PlainId(characterId), accountId });
		await this._accounts.updateOne({ id: accountId }, { $pull: { characters: { id: characterId } } });
	}

	public async setCharacterAccess(id: CharacterId): Promise<string | null> {
		const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId: nanoid(8) } }, { returnDocument: 'after' });
		return result.value?.accessId ?? null;
	}

	public async getDirectMessages(accounts: DirectMessageAccounts, limit: number, until?: number): Promise<IDirectoryDirectMessage[]> {
		return await this._directMessages
			.find(until ? { accounts, time: { $lt: until } } : { accounts })
			.sort({ time: -1 })
			.limit(limit)
			.toArray();
	}

	public async setDirectMessage(accounts: DirectMessageAccounts, message: IDirectoryDirectMessage): Promise<boolean> {
		if (message.edited === undefined) {
			await this._directMessages.insertOne({ ...message, accounts });
			return true;
		}
		if (message.content) {
			const { modifiedCount } = await this._directMessages.updateOne({ accounts, time: message.time }, { $set: { content: message.content, edited: message.edited } });
			return modifiedCount === 1;
		}
		const { deletedCount } = await this._directMessages.deleteOne({ accounts, time: message.time });
		return deletedCount === 1;
	}

	public async setDirectMessageInfo(accountId: number, directMessageInfo: IDirectoryDirectMessageInfo[]): Promise<void> {
		await this._accounts.updateOne({ id: accountId }, { $set: { directMessages: directMessageInfo } });
	}

	public async getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null> {
		if (accessId === false) {
			accessId = nanoid(8);
			const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId } }, { returnDocument: 'after' });
			return result.value ? Id(result.value) : null;
		}

		const character = await this._characters.findOne({ id: PlainId(id), accessId });
		if (!character)
			return null;

		return Id(character);
	}

	public async setCharacter({ id, accessId, ...data }: Partial<ICharacterData> & Pick<ICharacterData, 'id'>): Promise<boolean> {
		const { acknowledged, matchedCount } = await this._characters.updateOne({ id: PlainId(id), accessId }, { $set: data });
		return acknowledged && matchedCount === 1;
	}

	public async getConfig<T extends DatabaseConfig['type']>(type: T): Promise<null | (DatabaseConfig & { type: T; })['data']> {
		const result = await this._config.findOne({ type });
		return result?.data ?? null;
	}

	public async setConfig<T extends DatabaseConfig['type']>(type: T, data: (DatabaseConfig & { type: T; })['data']): Promise<void> {
		await this._config.updateOne({ type }, { $set: { data } }, { upsert: true });
	}

	private async _doMigrations(): Promise<void> {
		// insert migration code here
	}
}

async function CreateInMemoryMongo({
	dbPath,
}: {
	dbPath?: string;
} = {}): Promise<MongoMemoryServer> {
	const { MongoMemoryServer } = await import('mongodb-memory-server');
	if (dbPath) {
		const { mkdir } = await import('fs/promises');
		await mkdir(dbPath, { recursive: true });
	}
	return await MongoMemoryServer.create({
		binary: {
			version: '5.0.6',
			checkMD5: false,
		},
		instance: {
			dbPath,
			storageEngine: dbPath ? 'wiredTiger' : 'ephemeralForTest',
		},
	});
}

function Id(obj: Omit<ICharacterData, 'id'> & { id: number; }): ICharacterData {
	return {
		...obj,
		id: `c${obj.id}` as const,
	};
}

function PlainId(id: CharacterId): number {
	return parseInt(id.slice(1));
}
