import { GetLogger } from 'pandora-common/dist/logging';
import type { PandoraDatabase } from './databaseProvider';

import _ from 'lodash';

const logger = GetLogger('db');

export class MockDatabase implements PandoraDatabase {
	private accountDb: Set<DatabaseAccountWithSecure> = new Set();
	private _nextAccountId = 1;
	private get accountDbView(): DatabaseAccountWithSecure[] {
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
	public getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	public getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
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

	public createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		const acc = _.cloneDeep(data);
		const conflict = this.accountDbView.find(
			(dbAccount) =>
				dbAccount.username.toLowerCase() === acc.username.toLowerCase() ||
				dbAccount.secure.emailHash === acc.secure.emailHash,
		);
		if (conflict) {
			return Promise.resolve(conflict.username.toLowerCase() === acc.username.toLowerCase() ? 'usernameTaken' : 'emailTaken');
		}
		acc.id = this._nextAccountId++;
		this.accountDb.add(acc);
		return Promise.resolve(acc);
	}

	public setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.secure = _.cloneDeep(data);
		return Promise.resolve();
	}

	public getAccountSecure(email: string): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === email);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}
}
