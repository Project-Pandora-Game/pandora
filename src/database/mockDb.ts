import { GetLogger } from 'pandora-common/dist/logging';
import type { PandoraDatabase } from './databaseProvider';
import { CreateAccountData } from '../account/account';
import { PASSWORD_PREHASH_SALT } from 'pandora-common';

import _ from 'lodash';
import { createHash } from 'crypto';

function HashSHA512Base64(text: string): string {
	return createHash('sha512').update(text, 'utf-8').digest('base64');
}

export function PrehashPassword(password: string): string {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

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

	public async init(addTestAccounts?: false): Promise<this> {
		if (addTestAccounts === false)
			return this;

		this.accountDb.add(await CreateAccountData(
			'test',
			PrehashPassword('test'),
			'test@project-pandora.com',
			true,
		));
		this.accountDb.add(await CreateAccountData(
			'testinactive',
			PrehashPassword('test'),
			'testinactive@project-pandora.com',
			false,
		));
		return this;
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
	 * Get account by email hash
	 * @param emailHash - Email hash to search for
	 */
	public getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === emailHash);
		return Promise.resolve(_.cloneDeep(acc ?? null));
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
}
