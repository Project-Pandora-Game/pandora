import { ACTIVATION_TOKEN_EXPIRATION, EMAIL_SALT, LOGIN_TOKEN_EXPIRATION, PASSWORD_RESET_TOKEN_EXPIRATION } from '../config';
import { GetDatabase, PandoraDatabase } from '../database/databaseProvider';
import GetEmailSender, { IEmailSender } from '../services/email';

import { createHash, randomInt } from 'crypto';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';
import _ from 'lodash';

/**
 * Handles account security data
 *
 * JavaScript's private fields is used to ensure that the data is not exposed to the outside world
 */
export default class AccountSecure {
	readonly #account: { id: number, username: string; };
	readonly #secure: DatabaseAccountSecure;

	private get database(): PandoraDatabase {
		return GetDatabase();
	}
	private get email(): IEmailSender {
		return GetEmailSender();
	}

	constructor(account: { id: number, username: string; }, secure: DatabaseAccountSecure) {
		this.#account = account;
		this.#secure = secure;

		if (this.#secure.token && this.#secure.token.expiration < Date.now())
			this.#secure.token = undefined;

		this.#secure.loginTokens = this.#secure.loginTokens.filter((t) => t.expiration > Date.now());
	}

	public isActivated(): boolean {
		return this.#secure.activated;
	}

	public async sendActivation(email: string): Promise<void> {
		if (this.isActivated() || !this.verifyEmail(email))
			return;

		const token = this.#secure.token = GenerateToken(AccountTokenReason.ACTIVATION);
		await this.email.sendRegistrationConfirmation(email, this.#account.username, token.token);
	}

	public async activateAccount(token: string): Promise<boolean> {
		if (this.isActivated() || !this.#validateToken(token, AccountTokenReason.ACTIVATION))
			return false;

		this.#secure.token = undefined;
		this.#secure.activated = true;

		await this.#updateDatabase();
		return true;
	}

	public verifyEmail(email: string): boolean {
		const hash = GenerateEmailHash(email);
		return this.#secure.emailHash === hash;
	}

	public verifyPassword(password: string): Promise<boolean> {
		return argon2.verify(this.#secure.password, password);
	}

	public async changePassword(passwordOld: string, passwordNew: string): Promise<boolean> {
		if (!this.isActivated() || !await this.verifyPassword(passwordOld))
			return false;

		this.#secure.token = undefined;
		this.#secure.password = await GeneratePasswordHash(passwordNew);

		await this.#updateDatabase();

		return true;
	}

	public async resetPassword(email: string): Promise<boolean> {
		if (!this.isActivated() || !this.verifyEmail(email))
			return false;

		this.#secure.token = GenerateToken(AccountTokenReason.PASSWORD_RESET);

		await this.#updateDatabase();
		await this.email.sendPasswordReset(email, this.#account.username, this.#secure.token.token);

		return true;
	}

	public async finishPasswordReset(token: string, password: string): Promise<boolean> {
		if (!this.isActivated() || !this.#validateToken(token, AccountTokenReason.PASSWORD_RESET))
			return false;

		this.#secure.token = undefined;
		this.#secure.password = await GeneratePasswordHash(password);

		await this.#updateDatabase();

		return true;
	}

	public async generateNewLoginToken(): Promise<string> {
		const newToken = GenerateTokenBase('secure', LOGIN_TOKEN_EXPIRATION);
		this.#secure.loginTokens.push(newToken);
		this.#secure.loginTokens = this.#secure.loginTokens.filter((t) => t.expiration < Date.now());

		await this.#updateDatabase();
		return newToken.token;
	}

	public verifyLoginToken(token: string): boolean {
		return this.#secure.loginTokens.some((t) => t.token === token && t.expiration > Date.now());
	}

	#validateToken(token: string, reason: AccountTokenReason): boolean {
		if (!this.#secure.token)
			return false;

		const { token: currentToken, expiration, reason: currentReason } = this.#secure.token;
		return (
			currentToken === token &&
			currentReason === reason &&
			expiration > Date.now()
		);
	}

	async #updateDatabase(): Promise<void> {
		await this.database.setAccountSecure(this.#account.id, _.cloneDeep(this.#secure));
	}
}

export async function GenerateAccountSecureData(password: string, email: string): Promise<DatabaseAccountSecure> {
	return {
		password: await GeneratePasswordHash(password),
		emailHash: GenerateEmailHash(email),
		loginTokens: [],
		activated: false,
	};
}

export async function AccountSecurePasswordReset(email: string): Promise<void> {
	const hash = GenerateEmailHash(email);
	const account = await GetDatabase().getAccountSecure(hash);
	if (!account)
		return;

	const secure = new AccountSecure({ id: account.id, username: account.username }, account.secure);
	await secure.resetPassword(email);
}

/**
 * Generates a SHA-256 hash from email address
 * @param email - The email to hash
 * @returns - base64 encoded hash
 */
function GenerateEmailHash(email: string): string {
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

function GenerateTokenBase(type: 'secure' | 'simple', timeout: number): DatabaseLoginToken {
	return {
		token: type === 'simple' ? GenerateSimpleToken() : nanoid(32),
		expiration: Date.now() + timeout,
	};
}

const TOKEN_TYPES: Record<AccountTokenReason, 'secure' | 'simple'> = {
	[AccountTokenReason.ACTIVATION]: 'simple',
	[AccountTokenReason.PASSWORD_RESET]: 'simple',
};

const TOKEN_TIMEOUTS: Record<AccountTokenReason, number> = {
	[AccountTokenReason.ACTIVATION]: ACTIVATION_TOKEN_EXPIRATION,
	[AccountTokenReason.PASSWORD_RESET]: PASSWORD_RESET_TOKEN_EXPIRATION,
};

function GenerateToken(reason: AccountTokenReason): DatabaseAccountToken {
	return {
		...GenerateTokenBase(TOKEN_TYPES[reason], TOKEN_TIMEOUTS[reason]),
		reason,
	};
}
