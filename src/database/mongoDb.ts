import { GetLogger } from 'pandora-common/dist/logging';
import { DATABASE_URL, DATABASE_NAME } from '../config';
import type { PandoraDatabase } from './databaseProvider';

import AsyncLock from 'async-lock';
import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';

const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';

export default class MongoDatabase implements PandoraDatabase {
	private readonly _client: MongoClient;
	private readonly _lock: AsyncLock;
	private _db!: Db;
	private _accounts!: Collection<DatabaseAccountWithSecure>;
	private _nextId = 1;

	constructor() {
		this._client = new MongoClient(DATABASE_URL);
		this._lock = new AsyncLock();
	}

	public async init(): Promise<this> {
		if (this._db) {
			logger.error('Database already initialized');
			return this;
		}

		// if connection fails, error is thrown, application will exit
		await this._client.connect();

		this._db = this._client.db(DATABASE_NAME);
		this._accounts = this._db.collection(ACCOUNTS_COLLECTION_NAME);

		await this._accounts.createIndexes([
			{ key: { id: 1 } },
			{ key: { username: 1 } },
			{ key: { 'secure.emailHash': 1 } },
		], { unique: true });

		const [maxId] = await this._accounts.find().sort({ id: -1 }).limit(1).toArray();
		this._nextId = maxId ? maxId.id + 1 : 1;

		logger.info('Initialized MongoDB database');

		return this;
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

			data.id = this._nextId++;
			await this._accounts.insertOne(data);

			return await this.getAccountById(data.id) as DatabaseAccountWithSecure;
		});
	}

	public async setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		await this._accounts.updateOne({ id }, { $set: { secure: data } });
	}
}
