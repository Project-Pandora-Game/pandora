import type { CharacterId, ICharacterData, ICharacterDataUpdate } from 'pandora-common';
import type { ShardDatabase } from './databaseProvider';
import { GetLogger } from 'pandora-common/dist/logging';
import { DATABASE_URL, DATABASE_NAME } from '../config';

import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';

const logger = GetLogger('db');

const CHARACTERS_COLLECTION_NAME = 'characters';

export default class MongoDatabase implements ShardDatabase {
	private readonly _client: MongoClient;
	private _db!: Db;
	private _characters!: Collection<ICharacterData>;

	constructor() {
		this._client = new MongoClient(DATABASE_URL);
	}

	public async init(): Promise<this> {
		if (this._db) {
			logger.error('Database already initialized');
			return this;
		}

		// if connection fails, error is thrown, application will exit
		await this._client.connect();

		this._db = this._client.db(DATABASE_NAME);

		this._characters = this._db.collection(CHARACTERS_COLLECTION_NAME);

		await this._characters.createIndexes([
			{ key: { id: 1 } },
		], { unique: true });

		logger.info('Initialized MongoDB database');

		return this;
	}

	public async getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false> {
		return await this._characters.findOne({ id, accessId });
	}

	public async setCharacter({ id, accessId, ...data }: ICharacterDataUpdate): Promise<boolean> {
		const { acknowledged, modifiedCount } = await this._characters.updateOne({ id, accessId }, { $set: data });
		return modifiedCount === 1 && acknowledged;
	}
}
