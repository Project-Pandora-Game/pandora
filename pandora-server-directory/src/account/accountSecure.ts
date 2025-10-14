import { Assert, AssertNever, GetLogger, IAccountCryptoKey, Logger, TypedEventEmitter, type AccountManagementDisableInfo, type ManagementAccountInfoSecure } from 'pandora-common';
import { ENV } from '../config.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { AccountTokenReason, DatabaseAccountSecure, DatabaseAccountToken, GitHubInfo } from '../database/databaseStructure.ts';
import GetEmailSender from '../services/email/index.ts';
import type { Account } from './account.ts';
const { ACTIVATION_TOKEN_EXPIRATION, EMAIL_SALT, LOGIN_TOKEN_EXPIRATION, PASSWORD_RESET_TOKEN_EXPIRATION, RATE_LIMIT_EMAIL_CHANGE_NOT_ACTIVATED } = ENV;

import * as argon2 from 'argon2';
import { createHash, randomInt } from 'crypto';
import { cloneDeep } from 'lodash-es';
import { nanoid } from 'nanoid';
import { webcrypto } from 'node:crypto';
import { AUDIT_LOG } from '../logging.ts';

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

	public isDisabled(): Readonly<AccountManagementDisableInfo> | false {
		return cloneDeep(this.#secure.disabled ?? false);
	}

	public async sendActivation(email: string): Promise<void> {
		if (this.isActivated() || !this.verifyEmail(email))
			return;

		await this.#sendActivation(email, 'Activation requested');
	}

	public async overrideActivation(email: string, override: boolean): Promise<'ok' | 'alreadyActivated' | 'invalidEmail' | 'emailTaken' | number> {
		if (this.isActivated())
			return 'alreadyActivated';

		if (this.verifyEmail(email)) {
			await this.#sendActivation(email, 'Activation requested');
			return 'ok';
		}

		if (!override)
			return 'invalidEmail';

		const token = this.#tokens.find((t) => t.reason === AccountTokenReason.ACTIVATION);
		if (token != null) {
			const currentExpires = Date.now() + TOKEN_TYPES[AccountTokenReason.ACTIVATION].expiration;
			const timeLeft = currentExpires - token.expires;
			const rateLimit = RATE_LIMIT_EMAIL_CHANGE_NOT_ACTIVATED - timeLeft;
			if (rateLimit > 0)
				return rateLimit;
		}

		const emailHash = GenerateEmailHash(email);
		const result = await GetDatabase().updateAccountEmailHash(this.#account.id, emailHash);
		switch (result) {
			case 'ok':
				this.#secure.emailHash = emailHash;
				await this.#sendActivation(email, 'Activation requested, email updated');
				return 'ok';
			case 'emailTaken':
				return 'emailTaken';
			case 'notFound':
				Assert(false, 'Account not found');
				break;
			default:
				AssertNever(result);
		}
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

	public async changePassword(passwordOld: string, passwordNew: string, cryptoKey: IAccountCryptoKey): Promise<boolean> {
		if (!this.isActivated() || !await this.verifyPassword(passwordOld) || !await this.#validateCryptoKey(cryptoKey))
			return false;

		this.#secure.password = await GeneratePasswordHash(passwordNew);
		this.#secure.cryptoKey = cloneDeep(cryptoKey);
		// Invalidate all login tokens
		this.#invalidateToken(AccountTokenReason.LOGIN);
		this.#invalidateToken(AccountTokenReason.PASSWORD_RESET);

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

	/** Handle user logging in, doing security-based actions (such as updating last login time) */
	public async onLogin(): Promise<void> {
		const currentTime = Date.now();

		this.#account.data.lastLogin = currentTime;
		await GetDatabase().updateAccountData(this.#account.id, { lastLogin: currentTime });
	}

	public generateNewLoginToken(): Promise<AccountToken> {
		Assert(!this.isDisabled());
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

		// Ensure that tokens are sorted by expiration date
		this.#tokens = [...this.#tokens]
			.sort((a, b) => a.expires - b.expires);

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

	public getAdminInfo(): Readonly<ManagementAccountInfoSecure> {
		return cloneDeep<ManagementAccountInfoSecure>({
			activated: this.isActivated(),
			githubLink: this.getGitHubStatus() ?? null,
			disabled: this.#secure.disabled ?? null,
		});
	}

	public async adminDisableAccount(disabled: AccountManagementDisableInfo | null): Promise<void> {
		this.#secure.disabled = cloneDeep(disabled ?? undefined);

		if (disabled != null) {
			// Invalidate all login tokens for disabled accounts (this forces logout)
			this.#invalidateToken(AccountTokenReason.LOGIN);
		}

		await this.#updateDatabase();
	}

	public getCryptoKey(): IAccountCryptoKey | undefined {
		return this.#secure.cryptoKey;
	}

	public getPublicKey(): string | undefined {
		return this.#secure.cryptoKey?.publicKey;
	}

	public async setCryptoKey(key: IAccountCryptoKey, allowReset?: 'same-key' | 'replace-deleting-dms'): Promise<'ok' | 'invalid' | 'keyAlreadySet'> {
		if (this.#secure.cryptoKey != null) {
			if (
				allowReset !== 'replace-deleting-dms' &&
				(allowReset !== 'same-key' || this.#secure.cryptoKey.publicKey !== key.publicKey)
			) {
				return 'keyAlreadySet';
			}
		}

		if (!await this.#validateCryptoKey(key))
			return 'invalid';

		this.#secure.cryptoKey = cloneDeep(key);
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

			if (token.reason !== reason || (isInvalid != null && !isInvalid(token))) {
				tokens.push(token);
			} else {
				token.onDestroy();
			}
		}
		this.#tokens = tokens;
	}

	async #sendActivation(email: string, log: string): Promise<void> {
		const { value } = await this.#generateToken(AccountTokenReason.ACTIVATION);
		await GetEmailSender().sendRegistrationConfirmation(email, this.#account.username, value);
		this.#auditLog.info(log);
	}

	#updateDatabase(): Promise<void> {
		this.#secure.tokens = this.#tokens
			.filter((t) => t.validate())
			.map((t) => ({
				value: t.value,
				expires: t.expires,
				reason: t.reason,
			}));
		return GetDatabase().setAccountSecure(this.#account.id, cloneDeep(this.#secure));
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

export class AccountToken extends TypedEventEmitter<{
	tokenDestroyed: AccountToken;
	extended: AccountToken;
}> implements Readonly<DatabaseAccountToken> {
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
		super();
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
		return this.value.substring(0, 16);
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

		this.emit('tokenDestroyed', this);
	}

	public extend(): boolean {
		if (this.#destroyed)
			return false;

		const { generate, expiration } = TOKEN_TYPES[this.#reason];
		this.#value = generate();
		this.#expires = Date.now() + expiration;

		this.emit('extended', this);

		return true;
	}
}
