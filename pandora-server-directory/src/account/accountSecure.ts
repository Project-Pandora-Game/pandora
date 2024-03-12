import { ACCOUNT_TOKEN_ID_LENGTH, GetLogger, IAccountCryptoKey, Logger } from 'pandora-common';
import { ENV } from '../config';
const { ACTIVATION_TOKEN_EXPIRATION, EMAIL_SALT, LOGIN_TOKEN_EXPIRATION, PASSWORD_RESET_TOKEN_EXPIRATION } = ENV;
import { GetDatabase } from '../database/databaseProvider';
import GetEmailSender from '../services/email';
import type { Account } from './account';
import { DatabaseAccountSecure, DatabaseAccountToken, GitHubInfo } from '../database/databaseStructure';

import { createHash, randomInt } from 'crypto';
import { webcrypto } from 'node:crypto';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';
import _ from 'lodash';
import { AUDIT_LOG } from '../logging';

export enum AccountTokenReason {
	/** Account activation token */
	ACTIVATION = 1,
	/** Account password reset token */
	PASSWORD_RESET = 2,
	/** Account login token */
	LOGIN = 3,
}

/**
 * Handles account security data
 *
 * JavaScript's private fields is used to ensure that the data is not exposed to the outside world
 */
export default class AccountSecure {
	readonly #account: Account;
	readonly #secure: DatabaseAccountSecure;
	readonly #auditLog: Logger;
	#tokens: readonly AccountToken[];

	constructor(account: Account, secure: DatabaseAccountSecure) {
		this.#account = account;
		this.#secure = secure;
		this.#auditLog = AUDIT_LOG.prefixMessages(`[Account ${account.id}]`);

		this.#tokens = this.#secure.tokens
			.filter((t) => t.expires > Date.now())
			.map((t) => new AccountToken(t));
	}

	public isActivated(): boolean {
		return this.#secure.activated;
	}

	public async sendActivation(email: string): Promise<void> {
		if (this.isActivated() || !this.verifyEmail(email))
			return;

		const { value } = await this.#generateToken(AccountTokenReason.ACTIVATION);
		await GetEmailSender().sendRegistrationConfirmation(email, this.#account.username, value);

		this.#auditLog.info('Activation requested');
	}

	public async activateAccount(token: string): Promise<boolean> {
		if (this.isActivated() || !this.#validateToken(AccountTokenReason.ACTIVATION, token))
			return false;

		this.#invalidateToken(AccountTokenReason.ACTIVATION);
		this.#secure.activated = true;

		await this.#updateDatabase();

		this.#auditLog.verbose('Account activated');

		return true;
	}

	public verifyEmail(email: string): boolean {
		const hash = GenerateEmailHash(email);
		return this.#secure.emailHash === hash;
	}

	public verifyEmailHash(emailHash: string): boolean {
		return this.#secure.emailHash === emailHash;
	}

	public verifyPassword(password: string): Promise<boolean> {
		return argon2.verify(this.#secure.password, password);
	}

	public async changePassword(passwordOld: string, passwordNew: string, cryptoKey: IAccountCryptoKey, loginTokenId?: string | null): Promise<boolean> {
		if (!this.isActivated() || !await this.verifyPassword(passwordOld) || !await this.#validateCryptoKey(cryptoKey))
			return false;

		// Invalidate all login tokens except the one used to change the password
		if (loginTokenId != null) {
			this.#invalidateToken(AccountTokenReason.LOGIN, (t) => t.getId() !== loginTokenId);
		} else {
			this.#invalidateToken(AccountTokenReason.LOGIN);
		}

		this.#invalidateToken(AccountTokenReason.PASSWORD_RESET);
		this.#secure.password = await GeneratePasswordHash(passwordNew);
		this.#secure.cryptoKey = _.cloneDeep(cryptoKey);

		await this.#updateDatabase();

		this.#auditLog.info('Password changed');

		return true;
	}

	public async resetPassword(email: string): Promise<boolean> {
		if (!this.verifyEmail(email))
			return false;

		const { value } = await this.#generateToken(AccountTokenReason.PASSWORD_RESET);
		await GetEmailSender().sendPasswordReset(email, this.#account.username, value);

		this.#auditLog.info('Password reset requested');

		return true;
	}

	public async finishPasswordReset(token: string, password: string): Promise<boolean> {
		if (!this.#validateToken(AccountTokenReason.PASSWORD_RESET, token))
			return false;

		// Invalidate all login tokens
		this.#invalidateToken(AccountTokenReason.LOGIN);

		this.#invalidateToken(AccountTokenReason.PASSWORD_RESET);
		this.#secure.activated = true;
		this.#secure.password = await GeneratePasswordHash(password);
		this.#secure.cryptoKey = undefined;

		await this.#updateDatabase();

		this.#auditLog.info('Password reset');

		return true;
	}

	public generateNewLoginToken(): Promise<AccountToken> {
		return this.#generateToken(AccountTokenReason.LOGIN);
	}

	public async invalidateLoginToken(tokenId?: string): Promise<void> {
		const length = this.#tokens.length;

		if (!tokenId) {
			this.#invalidateToken(AccountTokenReason.LOGIN);
		} else {
			this.#invalidateToken(AccountTokenReason.LOGIN, (t) => t.getId() === tokenId);
		}

		if (length !== this.#tokens.length)
			await this.#updateDatabase();
	}

	public cleanupTokens(): void {
		this.#tokens = this.#tokens.filter((t) => t.validate());
	}

	public getLoginToken(token: string): AccountToken | undefined {
		return this.#findToken(AccountTokenReason.LOGIN, token);
	}

	public async extendLoginToken(password: string, loginTokenId: string | null): Promise<AccountToken | undefined> {
		if (!await this.verifyPassword(password))
			return undefined;

		const token = this.#tokens.find((t) => t.reason === AccountTokenReason.LOGIN && t.getId() === loginTokenId);
		if (!token || !token.extend())
			return undefined;

		this.#tokens = [...this.#tokens];
		await this.#updateDatabase();

		return token;
	}

	public getGitHubStatus(): undefined | { id: number; login: string; } {
		if (!this.#secure.github)
			return undefined;

		return {
			id: this.#secure.github.id,
			login: this.#secure.github.login,
		};
	}

	public async setGitHubInfo(info: Omit<GitHubInfo, 'date'> | null): Promise<boolean> {
		if (!info) {
			delete this.#secure.github;
			await this.#account.roles.setGitHubStatus('none');
			await this.#updateDatabase();
			return true;
		}
		if (this.#secure.github && this.#secure.github.id === info.id) {
			this.#secure.github.login = info.login;
			this.#secure.github.role = info.role;
			this.#secure.github.date = Date.now();
			await this.#account.roles.setGitHubStatus(info.role, info.teams);
			await this.#updateDatabase();
			return true;
		}

		const newInfo = { ...info, date: Date.now() };
		if (!await GetDatabase().setAccountSecureGitHub(this.#account.id, newInfo))
			return false;

		this.#secure.github = newInfo;
		await this.#account.roles.setGitHubStatus(newInfo.role, newInfo.teams);

		return true;
	}

	public getCryptoKey(): IAccountCryptoKey | undefined {
		return this.#secure.cryptoKey;
	}

	public getPublicKey(): string | undefined {
		return this.#secure.cryptoKey?.publicKey;
	}

	public async setInitialCryptoKey(key: IAccountCryptoKey): Promise<'ok' | 'invalid' | 'keyAlreadySet'> {
		if (this.#secure.cryptoKey != null)
			return 'keyAlreadySet';

		if (!await this.#validateCryptoKey(key))
			return 'invalid';

		this.#secure.cryptoKey = _.cloneDeep(key);
		await this.#updateDatabase();
		return 'ok';
	}

	async #validateCryptoKey({ publicKey }: IAccountCryptoKey): Promise<boolean> {
		return await IsPublicKey(publicKey);
	}

	async #generateToken(reason: AccountTokenReason): Promise<AccountToken> {
		const { limit } = TOKEN_TYPES[reason];

		const tokens = this.#tokens.filter((t) => t.validate());
		if (limit <= tokens.filter((t) => t.reason === reason).length) {
			const index = tokens.findIndex((t) => t.reason === reason);
			/* istanbul ignore else - should never happen because of positive limit is always positive */
			if (index !== -1) {
				tokens[index].onDestroy();
				tokens.splice(index, 1);
			}
		}

		const token = AccountToken.create(reason);
		this.#tokens = [...tokens, token];

		await this.#updateDatabase();

		return token;
	}

	#findToken(reason: AccountTokenReason, tokenSecret: string): AccountToken | undefined {
		const token = this.#tokens.find((t) => t.value === tokenSecret && t.reason === reason);
		return token?.validate() ? token : undefined;
	}

	#validateToken(reason: AccountTokenReason, tokenSecret: string): boolean {
		return this.#findToken(reason, tokenSecret) !== undefined;
	}

	#invalidateToken(reason: AccountTokenReason, isInvalid?: (token: AccountToken) => boolean): void {
		const tokens: AccountToken[] = [];
		for (const token of this.#tokens) {
			if (!token.validate())
				continue;

			if (token.reason !== reason || (isInvalid != null && !isInvalid(token)))
				tokens.push(token);
			else
				token.onDestroy();
		}
		this.#tokens = tokens;
	}

	#lastSavedTokens: readonly AccountToken[] | undefined;
	#updateDatabase(): Promise<void> {
		if (this.#lastSavedTokens !== this.#tokens) {
			this.#lastSavedTokens = this.#tokens;
			this.#secure.tokens = this.#tokens
				.filter((t) => t.validate())
				.map((t) => ({
					value: t.value,
					expires: t.expires,
					reason: t.reason,
				}));
		}
		return GetDatabase().setAccountSecure(this.#account.id, _.cloneDeep(this.#secure));
	}
}

export async function GenerateAccountSecureData(password: string, email: string, activated: boolean = false): Promise<DatabaseAccountSecure> {
	return {
		password: await GeneratePasswordHash(password),
		emailHash: GenerateEmailHash(email),
		tokens: [],
		activated,
	};
}

/**
 * Generates a SHA-256 hash from email address
 * @param email - The email to hash
 * @returns - base64 encoded hash
 */
export function GenerateEmailHash(email: string): string {
	return createHash('sha256').update(EMAIL_SALT).update(email.toLowerCase()).digest('base64');
}

async function IsPublicKey(keyData: string): Promise<boolean> {
	try {
		await webcrypto.subtle.importKey(
			'spki',
			Buffer.from(keyData, 'base64'),
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			[],
		);
		return true;
	} catch (e) {
		GetLogger('public-key').warning(e);
		return false;
	}
}

/**
 * Argon2 password options
 * @see https://github.com/ranisalt/node-argon2/wiki/Options
 */
const ARGON2_OPTIONS = {
	type: argon2.argon2id,
	parallelism: 4,
};

/**
 * Password hashing function uses Argon2di to hash the password
 * @param password - The password to hash
 * @returns - string containing the settings, hash and salt
 * @example result - '$argon2id$v=19$m=4096,t=3,p=1$dSzY4kzLGcr/+/I0YvF5mQ$jzKftP3Px0+4X1oYvSLQv8OKkM728OZjPNdgRbIUr2s'
 */
function GeneratePasswordHash(password: string): Promise<string> {
	return argon2.hash(password, ARGON2_OPTIONS);
}

function GenerateSimpleToken(): string {
	return randomInt(0, 1000000).toString(10).padStart(6, '0');
}

type TokenType = Record<AccountTokenReason, {
	generate: () => string;
	expiration: number;
	limit: number;
}>;

const TOKEN_TYPES = {
	[AccountTokenReason.ACTIVATION]: {
		generate: GenerateSimpleToken,
		expiration: ACTIVATION_TOKEN_EXPIRATION,
		limit: 1,
	},
	[AccountTokenReason.PASSWORD_RESET]: {
		generate: GenerateSimpleToken,
		expiration: PASSWORD_RESET_TOKEN_EXPIRATION,
		limit: 1,
	},
	[AccountTokenReason.LOGIN]: {
		generate: () => nanoid(32),
		expiration: LOGIN_TOKEN_EXPIRATION,
		limit: 5,
	},
} as const satisfies TokenType;

export interface AccountTokenOwner {
	onAccountTokenDestroyed(token: AccountToken): void;
}

export class AccountToken implements Readonly<DatabaseAccountToken> {
	readonly #bound = new Set<AccountTokenOwner>();
	readonly #reason: AccountTokenReason;
	#value: string;
	#expires: number;

	#destroyed = false;

	public get value(): string {
		return this.#value;
	}
	public get expires(): number {
		return this.#expires;
	}
	public get reason(): AccountTokenReason {
		return this.#reason;
	}

	constructor(token: Readonly<DatabaseAccountToken>) {
		this.#value = token.value;
		this.#expires = token.expires;
		this.#reason = token.reason;
	}

	public static create(reason: AccountTokenReason): AccountToken {
		const { generate, expiration } = TOKEN_TYPES[reason];
		return new AccountToken({
			value: generate(),
			expires: Date.now() + expiration,
			reason,
		});
	}

	public getId(): string {
		return this.value.substring(0, ACCOUNT_TOKEN_ID_LENGTH);
	}

	public bind(owner: AccountTokenOwner): void {
		this.#bound.add(owner);
	}

	public validate(): boolean {
		if (this.#destroyed)
			return false;

		if (this.expires <= Date.now()) {
			this.onDestroy();
			return false;
		}

		return true;
	}

	public onDestroy(): void {
		if (this.#destroyed)
			return;

		this.#destroyed = true;

		for (const owner of this.#bound) {
			owner.onAccountTokenDestroyed(this);
		}
		this.#bound.clear();
	}

	public extend(): boolean {
		if (this.#destroyed)
			return false;

		this.#expires = Date.now() + TOKEN_TYPES[this.reason].expiration;

		if (this.value.length > ACCOUNT_TOKEN_ID_LENGTH)
			this.#value = this.getId() + nanoid(32 - ACCOUNT_TOKEN_ID_LENGTH);

		return true;
	}
}
