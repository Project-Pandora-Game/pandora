import type {
	CharacterId,
	ICharacterDataShard,
	ICharacterDataShardUpdate,
	ServerService,
	SpaceData,
	SpaceDataShardUpdate,
	SpaceId,
} from 'pandora-common';
import { ENV } from '../config.ts';
import DirectoryDatabase from './directoryDb.ts';
import MongoDatabase from './mongoDb.ts';
const { DATABASE_TYPE } = ENV;

export interface ShardDatabase extends ServerService {
	/**
	 * Get a character's data
	 * @param id - Id of character
	 */
	getCharacter(id: CharacterId, accessId: string): Promise<ICharacterDataShard | null | false>;

	/**
	 * Update a character's data
	 * @param data - Character data with id
	 */
	setCharacter(id: CharacterId, data: ICharacterDataShardUpdate, accessId: string): Promise<boolean>;

	/**
	 * Get a space's data
	 * @param id - Id of the space
	 * @param accessId - Access id for accessing the data
	 */
	getSpaceData(id: SpaceId, accessId: string): Promise<Omit<SpaceData, 'config' | 'accessId' | 'owners' | 'ownerInvites'> | null | false>;

	/**
	 * Update a spaces's data
	 * @param id - Id of the space
	 * @param data - Data to update
	 * @param accessId - Access id for accessing the data
	 */
	setSpaceData(id: SpaceId, data: SpaceDataShardUpdate, accessId: string): Promise<boolean>;
}

/** Current database connection */
let database: MongoDatabase | DirectoryDatabase | undefined;

/** Gets the database service without initialization */
export function GetDatabaseService(): ShardDatabase {
	if (database) {
		return database;
	}
	if (DATABASE_TYPE === 'mongodb') {
		database = new MongoDatabase();
	} else {
		database = new DirectoryDatabase();
	}
	return database;
}

/** Get currently active database connection */
export function GetDatabase(): ShardDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
