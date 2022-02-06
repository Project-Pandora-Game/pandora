import { MockDatabase } from './mockDb';

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
}

/** Current database connection */
let database: PandoraDatabase | undefined;

/** Init database connection based on configuration */
export async function InitDatabase(): Promise<void> {
	database = await new MockDatabase().init();
}

/** Get currently active database connection */
export function GetDatabase(): PandoraDatabase {
	if (!database) {
		throw new Error('Database not initialized');
	}
	return database;
}
