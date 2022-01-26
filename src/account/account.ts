import type { IConnectionClient } from '../networking/common';
import { nanoid } from 'nanoid';
import { GetDatabase } from '../database/databaseProvider';
import { LOGIN_TOKEN_EXPIRATION } from '../config';

/** Currently logged in or recently used account */
export class Account {
	/** Time when this account was last used */
	public lastActivity: number;
	/** The account's saved data */
	public data: DatabaseAccount;
	/** List of connections logged in as this account */
	public associatedConnections: Set<IConnectionClient> = new Set();

	constructor(data: DatabaseAccount) {
		this.lastActivity = Date.now();
		this.data = data;
	}

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	/**
	 * Verify, that the password matches for this account
	 * @returns `true` if matches, `false` if the check failed
	 */
	public verifyPassword(password: string): Promise<boolean> {
		return Promise.resolve(this.data.secure.password === password);
	}

	/**
	 * Generate and save a new login token for this account
	 * @returns The new token
	 */
	public async generateNewLoginToken(): Promise<string> {
		const newToken: DatabaseLoginToken = {
			token: nanoid(),
			expiration: Date.now() + LOGIN_TOKEN_EXPIRATION,
		};
		this.data.secure.loginTokens.push(newToken);
		await GetDatabase().setAccountLoginTokens(this.data.id, this.data.secure.loginTokens);
		return newToken.token;
	}

	/**
	 * Verify validity of a token for this account
	 * @param token - The token to check
	 * @returns `true` if valid token is found, `false` if the check failed
	 */
	public verifyLoginToken(token: string): boolean {
		return this.data.secure.loginTokens.some((t) => t.token === token && t.expiration > Date.now());
	}
}
