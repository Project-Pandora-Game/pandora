import type { CharacterId, ICharacterData, ICharacterDataUpdate, IChatRoomData, IChatRoomDataShardUpdate, RoomId, Service } from 'pandora-common';
import { ENV } from '../config';
const { DATABASE_TYPE } = ENV;
import DirectoryDatabase from './directoryDb';
import MongoDatabase from './mongoDb';

export interface ShardDatabase extends Service {
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
	setChatRoom(id: RoomId, data: IChatRoomDataShardUpdate, accessId: string): Promise<boolean>;

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

export async function CloseDatabase(): Promise<void> {
	if (database instanceof MongoDatabase) {
		await database.onDestroy();
	}
}

/** Get currently active database connection */
export function GetDatabase(): ShardDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
