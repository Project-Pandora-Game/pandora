import { ACTIVATION_TOKEN_EXPIRATION, EMAIL_SALT, LOGIN_TOKEN_EXPIRATION, PASSWORD_RESET_TOKEN_EXPIRATION } from '../config';
import { GetDatabase } from '../database/databaseProvider';
import GetEmailSender from '../services/email';
import type { Account } from './account';

import { createHash, randomInt } from 'crypto';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';
import _ from 'lodash';

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

	constructor(account: Account, secure: DatabaseAccountSecure) {
		this.#account = account;
		this.#secure = secure;

		this.#secure.tokens = this.#secure.tokens.filter((t) => t.expires > Date.now());
	}

	public isActivated(): boolean {
		return this.#secure.activated;
	}

	public async sendActivation(email: string): Promise<void> {
		if (this.isActivated() || !this.verifyEmail(email))
			return;

		const { value } = await this.#generateToken(AccountTokenReason.ACTIVATION);
		await GetEmailSender().sendRegistrationConfirmation(email, this.#account.username, value);
	}

	public async activateAccount(token: string): Promise<boolean> {
		if (this.isActivated() || !this.#validateToken(AccountTokenReason.ACTIVATION, token))
			return false;

		this.#invalidateToken(AccountTokenReason.ACTIVATION);
		this.#secure.activated = true;

		await this.#updateDatabase();
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

	public async changePassword(passwordOld: string, passwordNew: string): Promise<boolean> {
		if (!this.isActivated() || !await this.verifyPassword(passwordOld))
			return false;

		this.#invalidateToken(AccountTokenReason.PASSWORD_RESET);
		this.#secure.password = await GeneratePasswordHash(passwordNew);

		await this.#updateDatabase();

		return true;
	}

	public async resetPassword(email: string): Promise<boolean> {
		if (!this.verifyEmail(email))
			return false;

		const { value } = await this.#generateToken(AccountTokenReason.PASSWORD_RESET);
		await GetEmailSender().sendPasswordReset(email, this.#account.username, value);

		return true;
	}

	public async finishPasswordReset(token: string, password: string): Promise<boolean> {
		if (!this.#validateToken(AccountTokenReason.PASSWORD_RESET, token))
			return false;

		this.#invalidateToken(AccountTokenReason.PASSWORD_RESET);
		this.#secure.activated = true;
		this.#secure.password = await GeneratePasswordHash(password);

		await this.#updateDatabase();

		return true;
	}

	public generateNewLoginToken(): Promise<DatabaseAccountToken> {
		return this.#generateToken(AccountTokenReason.LOGIN);
	}

	public async invalidateLoginToken(token: string): Promise<void> {
		const length = this.#secure.tokens.length;
		this.#invalidateToken(AccountTokenReason.LOGIN, token);

		if (length !== this.#secure.tokens.length)
			await this.#updateDatabase();
	}

	public verifyLoginToken(token: string): boolean {
		return this.#validateToken(AccountTokenReason.LOGIN, token);
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
			await this.#account.roles.setGitHubStatus(info.role);
			await this.#updateDatabase();
			return true;
		}

		const newInfo = { ...info, date: Date.now() };
		if (!await GetDatabase().setAccountSecureGitHub(this.#account.id, newInfo))
			return false;

		this.#secure.github = newInfo;
		await this.#account.roles.setGitHubStatus(newInfo.role);

		return true;
	}

	async #generateToken(reason: AccountTokenReason): Promise<DatabaseAccountToken> {
		this.#secure.tokens = this.#secure.tokens.filter((t) => t.expires > Date.now());
		if (TOKEN_LIMITS[reason] <= this.#secure.tokens.filter((t) => t.reason === reason).length) {
			const index = this.#secure.tokens.findIndex((t) => t.reason === reason);
			/* istanbul ignore else - should never happen because of positive TOKEN_LIMITS */
			if (index !== -1)
				this.#secure.tokens.splice(index, 1);
		}

		const token = {
			value: TOKEN_TYPES[reason] === 'simple' ? GenerateSimpleToken() : nanoid(32),
			expires: Date.now() + TOKEN_EXPIRATION[reason],
			reason,
		};

		this.#secure.tokens.push(token);
		await this.#updateDatabase();
		return token;
	}

	#validateToken(reason: AccountTokenReason, tokenSecret: string): boolean {
		const token = this.#secure.tokens.find((t) => t.value === tokenSecret && t.reason === reason);
		return !!token && token.expires > Date.now();
	}

	#invalidateToken(reason: AccountTokenReason, tokenSecret?: string): void {
		if (tokenSecret === undefined)
			this.#secure.tokens = this.#secure.tokens.filter((t) => t.reason !== reason);
		else
			this.#secure.tokens = this.#secure.tokens.filter((t) => t.value !== tokenSecret || t.reason !== reason);
	}

	async #updateDatabase(): Promise<void> {
		await GetDatabase().setAccountSecure(this.#account.id, _.cloneDeep(this.#secure));
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

const TOKEN_TYPES: Record<AccountTokenReason, 'secure' | 'simple'> = {
	[AccountTokenReason.ACTIVATION]: 'simple',
	[AccountTokenReason.PASSWORD_RESET]: 'simple',
	[AccountTokenReason.LOGIN]: 'secure',
};

const TOKEN_EXPIRATION: Record<AccountTokenReason, number> = {
	[AccountTokenReason.ACTIVATION]: ACTIVATION_TOKEN_EXPIRATION,
	[AccountTokenReason.PASSWORD_RESET]: PASSWORD_RESET_TOKEN_EXPIRATION,
	[AccountTokenReason.LOGIN]: LOGIN_TOKEN_EXPIRATION,
};

const TOKEN_LIMITS: Record<AccountTokenReason, number> = {
	[AccountTokenReason.ACTIVATION]: 1,
	[AccountTokenReason.PASSWORD_RESET]: 1,
	[AccountTokenReason.LOGIN]: 5,
};
