import { MockDatabase } from './mockDb';
import MongoDatabase from './mongoDb';
import { ENV } from '../config';
const { DATABASE_TYPE } = ENV;
import type { CharacterId, IChatRoomData, ICharacterData, ICharacterSelfInfo, ICharacterSelfInfoUpdate, IDirectoryDirectMessage, IChatRoomDataDirectoryUpdate, IChatRoomDataShardUpdate, RoomId, IChatRoomDirectoryData, AccountId, Service, ICharacterDataDirectoryUpdate, ICharacterDataShardUpdate } from 'pandora-common';
import type { IChatRoomCreationData } from './dbHelper';
import { ServiceInit } from 'pandora-common';
import { DatabaseAccountSecure, DatabaseAccountWithSecure, DatabaseConfigData, DatabaseConfigType, DatabaseDirectMessageInfo, DatabaseAccountContact, DirectMessageAccounts, DatabaseAccountContactType, DatabaseAccountUpdate } from './databaseStructure';

export type ICharacterSelfInfoDb = Omit<ICharacterSelfInfo, 'state'>;

export interface PandoraDatabase extends Service {
	/** The id in numeric form that will be assigned to next created account */
	readonly nextAccountId: number;

	/** The id in numeric form that will be assigned to next created character */
	readonly nextCharacterId: number;

	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	getAccountById(id: number): Promise<DatabaseAccountWithSecure | null>;
	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null>;
	/**
	 * Get account by email hash
	 * @param emailHash - Email hash to search for
	 */
	getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null>;

	/**
	 * Create account
	 *
	 * **CRITICAL SECTION** - High potential for race conditions
	 * @param data - Account data
	 * @returns The created account data or `null` if account already exists
	 */
	createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'>;

	/**
	 * Sets account settings
	 * @param id - Account id
	 * @param data - Settings data
	 */
	updateAccountData(id: AccountId, data: DatabaseAccountUpdate): Promise<void>;

	/**
	 * Sets account's secure data use should only be used in AccountSecure class
	 * @param id - Id of account to update
	 */
	setAccountSecure(id: AccountId, data: DatabaseAccountSecure): Promise<void>;

	/**
	 * Sets account's secure data use should only be used in AccountSecure class
	 * @param id - Id of account to update
	 */
	setAccountSecureGitHub(id: AccountId, data: DatabaseAccountSecure['github']): Promise<boolean>;

	queryAccountDisplayNames(query: AccountId[]): Promise<Record<AccountId, string>>;

	//#region Character

	/**
	 * Creates a new character for the account
	 * @param accountId - Id of account to create character for
	 * @param data - Character data
	 */
	createCharacter(accountId: AccountId): Promise<ICharacterSelfInfoDb>;

	/**
	 * Finish the character creation process
	 * @param accountId - Id of account to create character for
	 */
	finalizeCharacter(accountId: AccountId, characterId: CharacterId): Promise<ICharacterData | null>;

	/**
	 * Update character's self info
	 * @param accountId - Id of account to update character for
	 * @param data - Character info data
	 */
	updateCharacterSelfInfo(accountId: AccountId, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null>;

	/**
	 * Update character's info
	 * @param id - Id of the character to update
	 * @param data - Chatroom data to update, `id` is required
	 * @param accessId - Id of access to check or null to ignore the accessId check
	 * @returns false if a provided accessId is not the same as in the database
	 */
	updateCharacter(id: CharacterId, data: ICharacterDataDirectoryUpdate & ICharacterDataShardUpdate, accessId: string | null): Promise<boolean>;

	/**
	 * Delete character
	 * @param accountId - Id of account to delete character for
	 * @param characterId - Id of character to delete
	 */
	deleteCharacter(accountId: AccountId, characterId: CharacterId): Promise<void>;

	/**
	 * Sets a new access id for the account
	 * @param id - Id of character
	 * @return - New access id
	 */
	setCharacterAccess(id: CharacterId): Promise<string | null>;

	/**
	 * Lists all characters that are in a given room
	 * @param roomId - The id of a room to query for
	 */
	getCharactersInRoom(roomId: RoomId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]>;

	//#endregion

	//#region ChatRoom

	/**
	 * Gets all chatrooms that have supplied account as owner
	 * @param account - The owner of the rooms to look for
	 */
	getChatRoomsWithOwner(account: AccountId): Promise<IChatRoomDirectoryData[]>;

	/**
	 * Gets all chatrooms that have supplied account as owner or admin
	 * @param account - The owner/admin of the rooms to look for
	 */
	getChatRoomsWithOwnerOrAdmin(account: AccountId): Promise<IChatRoomDirectoryData[]>;

	/**
	 * Gets a chatroom by ID
	 * @param id - Id of the chatroom to get
	 * @param accessId - Id of access to check or null to ignore the accessId check
	 */
	getChatRoomById(id: RoomId, accessId: string | null): Promise<IChatRoomData | null>;

	/**
	 * Creates a new chatroom
	 * @param config - Config for the new room
	 * @param id - Id of the room (randomly generated if not set)
	 */
	createChatRoom(config: IChatRoomCreationData, id?: RoomId): Promise<IChatRoomData>;

	/**
	 * Update chatrooms's info
	 * @param data - Chatroom data to update, `id` is required
	 * @param accessId - Id of access to check or null to ignore the accessId check
	 * @returns false if a provided accessId is not the same as in the database
	 */
	updateChatRoom(id: RoomId, data: IChatRoomDataDirectoryUpdate & IChatRoomDataShardUpdate, accessId: string | null): Promise<boolean>;

	/**
	 * Delete a chatroom
	 * @param id - Id of the chatroom to delete
	 */
	deleteChatRoom(id: RoomId): Promise<void>;

	/**
	 * Sets a new access id for the room
	 * @param id - Id of the chatroom
	 * @return - New access id
	 */
	setChatRoomAccess(id: RoomId): Promise<string | null>;

	//#endregion

	/**
	 * Gets direct messages for the account
	 * @param keys - `${accountIdA}-${accessIdB}` where accountIdA < accountIdB
	 * @param limit - Max number of messages to return
	 * @param until - Get messages before this date
	 * @returns direct messages associated with the accounts
	 */
	getDirectMessages(keys: DirectMessageAccounts, limit: number, until?: number): Promise<IDirectoryDirectMessage[]>;

	/**
	 * Sets direct a direct message for the account
	 * @param keys - `${accountIdA}-${accessIdB}` where accountIdA < accountIdB
	 * @param message - direct messages to store
	 * @returns false only if message was an edit and it was not found
	 */
	setDirectMessage(keys: DirectMessageAccounts, message: IDirectoryDirectMessage): Promise<boolean>;

	/**
	 * Sets direct message info for the account
	 * @param accountId - Id of account to set unread direct messages for
	 * @param directMessageInfo - Direct message info to set
	 */
	setDirectMessageInfo(accountId: number, directMessageInfo: DatabaseDirectMessageInfo[]): Promise<void>;

	//#region Shard

	/**
	 * Get a character's data
	 * @param id - Id of character
	 * @param accessId - Id of access or false to generate a new one
	 */
	getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null>;

	//#endregion

	getAccountContacts(accountId: AccountId): Promise<DatabaseAccountContact[]>;
	setAccountContact(accountIdA: AccountId, accountIdB: AccountId, data: DatabaseAccountContactType): Promise<DatabaseAccountContact>;
	removeAccountContact(accountIdA: AccountId, accountIdB: AccountId): Promise<void>;

	//#region Config

	/**
	 * Get config data
	 * @param type
	 */
	getConfig<T extends DatabaseConfigType>(type: T): Promise<null | DatabaseConfigData<T>>;

	/**
	 * Set config data
	 * @param data
	 */
	setConfig<T extends DatabaseConfigType>(type: T, data: DatabaseConfigData<T>): Promise<void>;

	//#endregion
}

/** Current database connection */
let database: PandoraDatabase | undefined;

/** Init database connection based on configuration */
export async function InitDatabase(setDb?: typeof database): Promise<void> {
	if (setDb) {
		database = setDb;
		return;
	}
	switch (DATABASE_TYPE) {
		case 'mongodb':
			database = new MongoDatabase();
			break;
		case 'mongodb-in-memory':
			database = new MongoDatabase({ inMemory: true });
			break;
		case 'mongodb-local':
			database = new MongoDatabase({ inMemory: true, dbPath: './localDb' });
			break;
		case 'mock':
		default:
			database = new MockDatabase();
	}
	await ServiceInit(database);
}

export async function CloseDatabase(): Promise<void> {
	if (database instanceof MongoDatabase) {
		await database.onDestroy();
	}
}

/** Get currently active database connection */
export function GetDatabase(): PandoraDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
