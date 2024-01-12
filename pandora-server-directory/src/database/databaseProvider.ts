import { MockDatabase } from './mockDb';
import MongoDatabase from './mongoDb';
import { ENV } from '../config';
const { DATABASE_TYPE } = ENV;
import type { CharacterId, SpaceData, ICharacterData, ICharacterSelfInfo, ICharacterSelfInfoUpdate, IDirectoryDirectMessage, SpaceDataDirectoryUpdate, SpaceDataShardUpdate, SpaceId, SpaceDirectoryData, AccountId, Service, ICharacterDataDirectoryUpdate, ICharacterDataShardUpdate } from 'pandora-common';
import type { SpaceCreationData } from './dbHelper';
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
	 * @param data - Character data to update
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
	 * Lists all characters that are in a given space
	 * @param space - The id of a space to query for
	 */
	getCharactersInSpace(spaceId: SpaceId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]>;

	//#endregion

	//#region Spaces

	/**
	 * Gets all spaces that have supplied account as owner
	 * @param account - The owner of the spaces to look for
	 */
	getSpacesWithOwner(account: AccountId): Promise<SpaceDirectoryData[]>;

	/**
	 * Gets all spaces that have supplied account as owner or admin
	 * @param account - The owner/admin of the spaces to look for
	 */
	getSpacesWithOwnerOrAdmin(account: AccountId): Promise<SpaceDirectoryData[]>;

	/**
	 * Gets a space data by ID
	 * @param id - Id of the space to get
	 * @param accessId - Id of access to check or null to ignore the accessId check
	 */
	getSpaceById(id: SpaceId, accessId: string | null): Promise<SpaceData | null>;

	/**
	 * Creates a new space
	 * @param config - Config for the new space
	 * @param id - Id of the space (randomly generated if not set)
	 */
	createSpace(config: SpaceCreationData, id?: SpaceId): Promise<SpaceData>;

	/**
	 * Update space's info
	 * @param id - Id of the space to update
	 * @param data - Space data to update
	 * @param accessId - Id of access to check or null to ignore the accessId check
	 * @returns false if a provided accessId is not the same as in the database
	 */
	updateSpace(id: SpaceId, data: SpaceDataDirectoryUpdate & SpaceDataShardUpdate, accessId: string | null): Promise<boolean>;

	/**
	 * Delete a space
	 * @param id - Id of the space to delete
	 */
	deleteSpace(id: SpaceId): Promise<void>;

	/**
	 * Sets a new access id for the space
	 * @param id - Id of the space
	 * @return - New access id
	 */
	setSpaceAccessId(id: SpaceId): Promise<string | null>;

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

/** Gets the database service without initialization */
export function GetDatabaseService(): PandoraDatabase {
	if (database) {
		return database;
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
	return database;
}

/** Sets and initialize the database for tests */
export async function InitDatabaseForTests(setDb: typeof database): Promise<void> {
	database = setDb;
	await ServiceInit(GetDatabaseService());
}

/** Get currently active database connection */
export function GetDatabase(): PandoraDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
