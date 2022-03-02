import { MockDatabase } from './mockDb';
import MongoDatabase from './mongoDb';
import { DATABASE_TYPE } from '../config';
import type { CharacterId, ICharacterData, ICharacterDataAccess, ICharacterSelfInfo, ICharacterSelfInfoUpdate } from 'pandora-common/dist/character';

export type ICharacterSelfInfoDb = Omit<ICharacterSelfInfo, 'state'>;

export interface PandoraDatabase {
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
	 * Sets account's secure data use should only be used in AccountSecure class
	 * @param id - Id of account to update
	 */
	setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void>;

	/**
	 * Creates a new character for the account
	 * @param accountId - Id of account to create character for
	 * @param data - Character data
	 */
	createCharacter(accountId: number): Promise<{ info: ICharacterSelfInfoDb, char: ICharacterData; }>;

	/**
	 * Finish the character creation process
	 * @param accountId - Id of account to create character for
	 */
	finalizeCharacter(accountId: number): Promise<ICharacterData | null>;

	/**
	 * Update character's self info
	 * @param accountId - Id of account to update character for
	 * @param data - Character info data
	 */
	updateCharacter(accountId: number, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null>;

	/**
	 * Delete character
	 * @param accountId - Id of account to delete character for
	 * @param characterId - Id of character to delete
	 */
	deleteCharacter(accountId: number, characterId: CharacterId): Promise<void>;

	/**
	 * Sets a new access id for the account
	 * @param id - Id of character
	 * @return - New access id
	 */
	setCharacterAccess(id: CharacterId): Promise<string | null>;

	//#region Shard

	/**
	 * Get a character's data
	 * @param id - Id of character
	 * @param accessId - Id of access or false to generate a new one
	 */
	getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null>;

	/**
	 * Update a character's data
	 * @param data - Character data with id
	 */
	setCharacter(data: Partial<ICharacterData> & ICharacterDataAccess): Promise<boolean>;

	//#endregion
}

/** Current database connection */
let database: PandoraDatabase | undefined;

/** Init database connection based on configuration */
export async function InitDatabase(): Promise<void> {
	switch (DATABASE_TYPE) {
		case 'mongodb':
		case 'mongodb-in-memory':
			database = await new MongoDatabase().init();
			break;
		case 'mock':
		default:
			database = await new MockDatabase().init();
	}
}

/** Get currently active database connection */
export function GetDatabase(): PandoraDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
