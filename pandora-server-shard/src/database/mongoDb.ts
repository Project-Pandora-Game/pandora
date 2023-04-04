import { CharacterId, ICharacterData, ICharacterDataUpdate, GetLogger, RoomId, IChatRoomData, IChatRoomDataShardUpdate } from 'pandora-common';
import type { ShardDatabase } from './databaseProvider';
import { DATABASE_URL, DATABASE_NAME } from '../config';

import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';

const logger = GetLogger('db');

const CHARACTERS_COLLECTION_NAME = 'characters';
const CHATROOMS_COLLECTION_NAME = 'chatrooms';

export default class MongoDatabase implements ShardDatabase {
	private readonly _client: MongoClient;
	private _db!: Db;
	private _characters!: Collection<Omit<ICharacterData, 'id'> & { id: number; }>;
	private _chatrooms!: Collection<IChatRoomData>;

	constructor() {
		this._client = new MongoClient(DATABASE_URL, {
			ignoreUndefined: true,
		});
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
		this._chatrooms = this._db.collection(CHATROOMS_COLLECTION_NAME);

		logger.info('Initialized MongoDB database');

		return this;
	}

	public async close(): Promise<void> {
		await this._client.close();
	}

	public async getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false> {
		const character = await this._characters.findOne({ id: PlainId(id), accessId });
		if (!character)
			return null;

		return Id(character);
	}

	public async setCharacter({ id, accessId, ...data }: ICharacterDataUpdate): Promise<boolean> {
		const { acknowledged, modifiedCount } = await this._characters.updateOne({ id: PlainId(id), accessId }, { $set: data });
		return acknowledged && modifiedCount === 1;
	}

	public async getChatRoom(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null | false> {
		const result = await this._chatrooms
			.find({ id, accessId })
			.project<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'>>({ config: 0, accessId: 0, owners: 0 }).toArray();
		if (result.length !== 1)
			return null;
		return result[0];
	}

	public async setChatRoom(id: RoomId, data: IChatRoomDataShardUpdate, accessId: string): Promise<boolean> {
		const { acknowledged, modifiedCount } = await this._chatrooms.updateOne({ id, accessId }, { $set: data });
		return acknowledged && modifiedCount === 1;
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
