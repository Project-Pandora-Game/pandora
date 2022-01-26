import { GetLogger } from 'pandora-common/dist/logging';
import type { PandoraDatabase } from './databaseProvider';

import _ from 'lodash';

const logger = GetLogger('db');

export class MockDatabase implements PandoraDatabase {
	private accountDb: Set<DatabaseAccount> = new Set();
	private get accountDbView(): DatabaseAccount[] {
		return Array.from(this.accountDb.values());
	}

	constructor() {
		logger.info('Initialized mock database');
	}

	public init(): Promise<this> {
		return Promise.resolve(this);
	}

	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	public getAccountById(id: number): Promise<DatabaseAccount | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	public getAccountByUsername(username: string): Promise<DatabaseAccount | null> {
		username = username.toLowerCase();
		const acc = this.accountDbView.find((dbAccount) => dbAccount.username.toLowerCase() === username);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Update account's auth tokens
	 * @param id - Id of account to update
	 * @param tokens - Array of tokens to replace current ones with
	 */
	public setAccountLoginTokens(id: number, tokens: DatabaseLoginToken[]): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (acc) {
			acc.secure.loginTokens = _.cloneDeep(tokens);
			return Promise.resolve();
		}
		return Promise.reject('Account not found in DB');
	}
}
