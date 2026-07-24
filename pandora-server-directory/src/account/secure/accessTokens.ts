import AsyncLock from 'async-lock';
import { cloneDeep, debounce } from 'lodash-es';
import { customAlphabet as nanoCustomAlphabet, nanoid } from 'nanoid';
import { AsyncSynchronized, LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT, PandoraAccessTokenGenerate, TypedEventEmitter, type Logger, type PandoraAccessToken, type PandoraAccessTokenData, type PandoraAccessTokenInfo, type PandoraAccessTokenScope, type PandoraAccessTokenScopeList } from 'pandora-common';
import promClient from 'prom-client';
import { GetDatabase } from '../../database/databaseProvider.ts';
import type AccountSecure from '../accountSecure.ts';

const GlobalTokenLock = new AsyncLock({
	maxExecutionTime: 60_000,
});

const AccessTokenSecretGenerator = nanoCustomAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

const tokenUseMetric = new promClient.Counter({
	name: 'pandora_directory_access_token_usage',
	help: 'Count of uses of access tokens by scope. Use requiring multiple scopes counts multiple times.',
	labelNames: ['scope'],
});

const LAST_USE_UPDATE_DEBOUNCE = 5000; // Update "last use" value only at most every 5 seconds

export class AccountSecureAccessTokenStore extends TypedEventEmitter<{
	tokenInvalidated: PandoraAccessToken;
}> {
	readonly #tokens: PandoraAccessTokenData[];
	readonly #accountSecure: AccountSecure;

	private readonly _auditLog: Logger;

	constructor(tokens: PandoraAccessTokenData[], parentAccountSecure: AccountSecure, auditLog: Logger) {
		super();
		this.#tokens = tokens;
		this.#accountSecure = parentAccountSecure;
		this._auditLog = auditLog;
	}

	public getTokenInfo(token: PandoraAccessToken): PandoraAccessTokenInfo | null {
		const data = this.#tokens.find((t) => t.token === token);
		return data != null ? {
			id: data.id,
			name: data.name,
			scopes: cloneDeep(data.scopes),
			created: data.created,
			lastUsed: data.lastUsed,
			expires: data.expires,
		} : null;
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

	private readonly _delayedUpdateDebounced = debounce(() => {
		this.#accountSecure.updateDatabase()
			.catch((err) => {
				this._auditLog.warning('Failed to update lastUsed on token:', err);
			});
		this.#accountSecure.account.associatedConnections.sendMessage('somethingChanged', {
			changes: ['accessTokens'],
		});
	}, LAST_USE_UPDATE_DEBOUNCE, { maxWait: LAST_USE_UPDATE_DEBOUNCE });

	public verifyToken(token: PandoraAccessToken, requiredScopes: readonly PandoraAccessTokenScope[]): boolean {
		// Only activated, non-banned accounts can make use of tokens, otherwise treat the token as invalid
		if (!this.#accountSecure.isActivated() || this.#accountSecure.isDisabled())
			return false;

		const tokenData = this.#tokens.find((t) => t.token === token);

		const now = Date.now();
		if (tokenData == null || (tokenData.expires != null && now >= tokenData.expires))
			return false;

		// If the token exists and is valid, update "lastUsed" (even if scopes don't match)
		tokenData.lastUsed = now;
		this._delayedUpdateDebounced();

		const result = requiredScopes.every((s) => tokenData.scopes.includes(s));
		// Count metrics
		if (result) {
			if (requiredScopes.length > 0) {
				for (const scope of requiredScopes) {
					tokenUseMetric.inc({ scope }, 1);
				}
			} else {
				tokenUseMetric.inc({ scope: 'basic' }, 1);
			}
		}
		return result;
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
		this.#accountSecure.account.associatedConnections.sendMessage('somethingChanged', {
			changes: ['accessTokens'],
		});

		return tokenData;
	}

	@AsyncSynchronized('object')
	@AsyncSynchronized(GlobalTokenLock)
	public async regenerateToken(id: string, expires: number | null): Promise<PandoraAccessTokenData | 'notFound'> {
		const tokenData = this.#tokens.find((t) => t.id === id);
		if (tokenData == null)
			return 'notFound';

		const oldToken = tokenData.token;

		// Generate a token and check against unicorns
		const token = AccountSecureAccessTokenStore._generateRandomToken();
		if ((await GetDatabase().getAccountIdByAccessToken(token)) != null) {
			throw new Error('Encountered a unicorn! (generated duplicate access token)');
		}

		tokenData.token = token;
		tokenData.expires = expires;

		await this.#accountSecure.updateDatabase();
		this.emit('tokenInvalidated', oldToken);
		this.#accountSecure.account.associatedConnections.sendMessage('somethingChanged', {
			changes: ['accessTokens'],
		});

		return tokenData;
	}

	@AsyncSynchronized('object')
	public async deleteToken(id: string): Promise<boolean> {
		const index = this.#tokens.findIndex((t) => t.id === id);
		if (index < 0)
			return false;

		const oldToken = this.#tokens[index].token;
		this.#tokens.splice(index, 1);

		await this.#accountSecure.updateDatabase();
		this.emit('tokenInvalidated', oldToken);
		this.#accountSecure.account.associatedConnections.sendMessage('somethingChanged', {
			changes: ['accessTokens'],
		});

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
		this.#accountSecure.account.associatedConnections.sendMessage('somethingChanged', {
			changes: ['accessTokens'],
		});

		return true;
	}

	public _export(): PandoraAccessTokenData[] {
		return cloneDeep(this.#tokens);
	}

	private static _generateRandomToken(): PandoraAccessToken {
		return PandoraAccessTokenGenerate(AccessTokenSecretGenerator(32));
	}
}
