import type { CharacterId, ICharacterData, ICharacterDataUpdate } from 'pandora-common';
import { DATABASE_TYPE } from '../config';
import DirectoryDatabase from './directoryDb';
import MongoDatabase from './mongoDb';

export interface ShardDatabase {
	/**
	 * Get a character's data
	 * @param id - Id of character
	 */
	getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false>;

	/**
	 * Update a character's data
	 * @param data - Character data with id
	 */
	setCharacter(data: ICharacterDataUpdate): Promise<boolean>;
}

/** Current database connection */
let database: MongoDatabase | DirectoryDatabase | undefined;

/** Init database connection based on configuration */
export function CreateDatabase(): MongoDatabase | DirectoryDatabase {
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
