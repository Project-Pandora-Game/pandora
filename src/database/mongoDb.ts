/* eslint-disable @typescript-eslint/naming-convention */ // MongoDB
import { CharacterId, ICharacterData, ICharacterSelfInfoUpdate, GetLogger, CHARACTER_DEFAULT_PUBLIC_SETTINGS } from 'pandora-common';
import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { DATABASE_URL, DATABASE_NAME } from '../config';

import _ from 'lodash';
import AsyncLock from 'async-lock';
import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { nanoid } from 'nanoid';

const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';
const CHARACTERS_COLLECTION_NAME = 'characters';

export default class MongoDatabase implements PandoraDatabase {
	private readonly _lock: AsyncLock;
	private readonly _url: string;
	private _client!: MongoClient;
	private _inMemoryServer!: MongoMemoryServer;
	private _db!: Db;
	private _accounts!: Collection<DatabaseAccountWithSecure>;
	private _characters!: Collection<Omit<ICharacterData, 'id'> & { id: number; }>;
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

	public async setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		await this._accounts.updateOne({ id }, { $set: { secure: data } });
	}

	public async createCharacter(accountId: number): Promise<ICharacterSelfInfoDb> {
		return await this._lock.acquire('createCharacter', async () => {
			if (!await this.getAccountById(accountId))
				throw new Error('Account not found');

			const id = this._nextCharacterId++;
			const infoId: CharacterId = `c${id}`;
			const info: ICharacterSelfInfoDb = {
				inCreation: true,
				id: infoId,
				name: '',
				preview: '',
			};
			const char: Omit<ICharacterData, 'id'> & { id: number; } = {
				inCreation: true,
				id,
				accountId,
				name: info.name,
				created: -1,
				accessId: nanoid(8),
				settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
			};

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
		const result = await this._accounts.findOneAndUpdate({ 'id': accountId, 'characters.id': id }, { $set: update }, { returnDocument: 'after' });
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
		const { acknowledged, modifiedCount } = await this._characters.updateOne({ id: PlainId(id), accessId }, { $set: data });
		return acknowledged && modifiedCount === 1;
	}

	private async _doMigrations(): Promise<void> {
		// await this._characters.updateMany({ settings: { $exists: false } }, { $set: { settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS) } });
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
		id: `c${obj.id}`,
	};
}

function PlainId(id: CharacterId): number {
	return parseInt(id.slice(1));
}
