import type { CharacterId, ICharacterData, ICharacterDataUpdate, IChatRoomData, IChatRoomDataUpdate, RoomId } from 'pandora-common';
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

	/**
	 * Get a room's data
	 * @param id - Id of room
	 */
	getChatRoom(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null | false>;

	/**
	 * Update a room's data
	 * @param data - Room data with id
	 */
	setChatRoom(data: IChatRoomDataUpdate, accessId: string): Promise<boolean>;

}

/** Current database connection */
let database: ShardDatabase | undefined;

/** Init database connection based on configuration */
export async function InitDatabase(): Promise<void> {
	if (DATABASE_TYPE === 'mongodb') {
		database = await new MongoDatabase().init();
	} else {
		database = await new DirectoryDatabase().init();
	}
}

/** Get currently active database connection */
export function GetDatabase(): ShardDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
