import AsyncLock from 'async-lock';
import { cloneDeep } from 'lodash-es';
import { customAlphabet as nanoCustomAlphabet, nanoid } from 'nanoid';
import { AsyncSynchronized, LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT, PandoraAccessTokenGenerate, type Logger, type PandoraAccessToken, type PandoraAccessTokenData, type PandoraAccessTokenInfo, type PandoraAccessTokenScope, type PandoraAccessTokenScopeList } from 'pandora-common';
import { GetDatabase } from '../../database/databaseProvider.ts';
import type AccountSecure from '../accountSecure.ts';

const GlobalTokenLock = new AsyncLock({
	maxExecutionTime: 60_000,
});

const AccessTokenSecretGenerator = nanoCustomAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

export class AccountSecureAccessTokenStore {
	readonly #tokens: PandoraAccessTokenData[];
	readonly #accountSecure: AccountSecure;

	private readonly _auditLog: Logger;

	constructor(tokens: PandoraAccessTokenData[], parentAccountSecure: AccountSecure, auditLog: Logger) {
		this.#tokens = tokens;
		this.#accountSecure = parentAccountSecure;
		this._auditLog = auditLog;
	}

	public listTokens(): PandoraAccessTokenInfo[] {
		return this.#tokens.map((t): PandoraAccessTokenInfo => ({
			id: t.id,
			name: t.name,
			scopes: cloneDeep(t.scopes),
			created: t.created,
			lastUsed: t.lastUsed,
			expires: t.expires,
		}));
	}

	public verifyToken(token: PandoraAccessToken, requiredScopes: readonly PandoraAccessTokenScope[]): boolean {
		const tokenData = this.#tokens.find((t) => t.token === token);

		const now = Date.now();
		if (tokenData == null || (tokenData.expires != null && now < tokenData.expires))
			return false;

		// If the token exists and is valid, update "lastUsed" (even if scopes don't match)
		tokenData.lastUsed = now;
		this.#accountSecure.updateDatabase()
			.catch((err) => {
				this._auditLog.warning('Failed to update lastUsed on token:', err);
			});

		return requiredScopes.every((s) => tokenData.scopes.includes(s));
	}

	@AsyncSynchronized('object')
	@AsyncSynchronized(GlobalTokenLock)
	public async createToken(name: string, scopes: PandoraAccessTokenScopeList, expires: number | null): Promise<PandoraAccessTokenData | 'limitReached'> {
		if (this.#tokens.length >= LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT)
			return 'limitReached';

		// Generate a token and check against unicorns
		const token = AccountSecureAccessTokenStore._generateRandomToken();
		if ((await GetDatabase().getAccountIdByAccessToken(token)) != null) {
			throw new Error('Encountered a unicorn! (generated duplicate access token)');
		}

		let id: string;
		do {
			id = nanoid(8);
		} while (this.#tokens.some((t) => t.id === id));

		const tokenData: PandoraAccessTokenData = {
			token,
			id,
			name,
			scopes,
			created: Date.now(),
			expires,
		};
		this.#tokens.push(cloneDeep(tokenData));

		await this.#accountSecure.updateDatabase();

		return tokenData;
	}

	@AsyncSynchronized('object')
	@AsyncSynchronized(GlobalTokenLock)
	public async regenerateToken(id: string, expires: number | null): Promise<PandoraAccessTokenData | 'notFound'> {
		const tokenData = this.#tokens.find((t) => t.id === id);
		if (tokenData == null)
			return 'notFound';

		// Generate a token and check against unicorns
		const token = AccountSecureAccessTokenStore._generateRandomToken();
		if ((await GetDatabase().getAccountIdByAccessToken(token)) != null) {
			throw new Error('Encountered a unicorn! (generated duplicate access token)');
		}

		tokenData.token = token;
		tokenData.expires = expires;

		await this.#accountSecure.updateDatabase();

		return tokenData;
	}

	@AsyncSynchronized('object')
	public async deleteToken(id: string): Promise<boolean> {
		const index = this.#tokens.findIndex((t) => t.id === id);
		if (index < 0)
			return false;

		this.#tokens.splice(index, 1);

		await this.#accountSecure.updateDatabase();

		return true;
	}

	@AsyncSynchronized('object')
	public async updateToken(id: string, name: string, scopes: PandoraAccessTokenScopeList): Promise<boolean> {
		const token = this.#tokens.find((t) => t.id === id);
		if (token == null)
			return false;

		token.name = name;
		token.scopes = cloneDeep(scopes);

		await this.#accountSecure.updateDatabase();

		return true;
	}

	public _export(): PandoraAccessTokenData[] {
		return cloneDeep(this.#tokens);
	}

	private static _generateRandomToken(): PandoraAccessToken {
		return PandoraAccessTokenGenerate(AccessTokenSecretGenerator(32));
	}
}
