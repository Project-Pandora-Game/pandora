import {
	CharacterId,
	ICharacterData,
	GetLogger,
	SpaceId,
	SpaceData,
	SpaceDataShardUpdate,
	ICharacterDataShardUpdate,
} from 'pandora-common';
import type { ShardDatabase } from './databaseProvider';
import { ENV } from '../config';
const { DATABASE_URL, DATABASE_NAME } = ENV;

import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';

const logger = GetLogger('db');

const CHARACTERS_COLLECTION_NAME = 'characters';
// TODO(spaces): Consider migrating this
const SPACES_COLLECTION_NAME = 'chatrooms';

export default class MongoDatabase implements ShardDatabase {
	private readonly _client: MongoClient;
	private _db!: Db;
	private _characters!: Collection<Omit<ICharacterData, 'id'> & { id: number; }>;
	private _spaces!: Collection<SpaceData>;

	constructor() {
		this._client = new MongoClient(DATABASE_URL, {
			ignoreUndefined: true,
		});
	}

	public async init(): Promise<void> {
		if (this._db) {
			logger.error('Database already initialized');
			return;
		}

		// if connection fails, error is thrown, application will exit
		await this._client.connect();

		this._db = this._client.db(DATABASE_NAME);

		this._characters = this._db.collection(CHARACTERS_COLLECTION_NAME);
		this._spaces = this._db.collection(SPACES_COLLECTION_NAME);

		logger.info('Initialized MongoDB database');
	}

	public async onDestroy(): Promise<void> {
		await this._client.close();
	}

	public async getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false> {
		const character = await this._characters.findOne({ id: PlainId(id), accessId });
		if (!character)
			return null;

		return Id(character);
	}

	public async setCharacter(id: CharacterId, data: ICharacterDataShardUpdate, accessId: string): Promise<boolean> {
		const { matchedCount } = await this._characters.updateOne({ id: PlainId(id), accessId }, { $set: data });
		return matchedCount === 1;
	}

	public async getSpaceData(id: SpaceId, accessId: string): Promise<Omit<SpaceData, 'config' | 'accessId' | 'owners'> | null | false> {
		const result = await this._spaces
			.find({ id, accessId })
			.project<Omit<SpaceData, 'config' | 'accessId' | 'owners'>>({ config: 0, accessId: 0, owners: 0 }).toArray();
		if (result.length !== 1)
			return null;
		return result[0];
	}

	public async setSpaceData(id: SpaceId, data: SpaceDataShardUpdate, accessId: string): Promise<boolean> {
		const { matchedCount } = await this._spaces.updateOne({ id, accessId }, { $set: data });
		return matchedCount === 1;
	}
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
