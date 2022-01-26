import { MockDatabase } from './mockDb';

export interface PandoraDatabase {
	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	getAccountById(id: number): Promise<DatabaseAccount | null>;
	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	getAccountByUsername(username: string): Promise<DatabaseAccount | null>;
	/**
	 * Update account's auth tokens
	 * @param id - Id of account to update
	 * @param tokens - Array of tokens to replace current ones with
	 */
	setAccountLoginTokens(id: number, tokens: DatabaseLoginToken[]): Promise<void>;
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
