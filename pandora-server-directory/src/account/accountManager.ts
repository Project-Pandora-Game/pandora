import { GetDatabase } from '../database/databaseProvider';
import { GetLogger } from 'pandora-common';
import { Account, CreateAccountData } from './account';
import promClient from 'prom-client';
import { DiscordBot } from '../services/discord/discordBot';
import { AUTO_ADMIN_FIRST_USER } from '../config';

/** Time (in ms) after which manager prunes account without any active connection */
export const ACCOUNT_INACTIVITY_THRESHOLD = 60_000;
/** Time (in ms) of how often manager checks for accounts to prune */
export const ACCOUNTMANAGER_TICK_INTERVAL = 15_000;

const logger = GetLogger('AccountManager');

const totalAccountsMetric = new promClient.Gauge({
	name: 'pandora_directory_accounts',
	help: 'Total count of accounts ever created',
});

const totalCharactersMetric = new promClient.Gauge({
	name: 'pandora_directory_characters',
	help: 'Total count of characters ever created',
});

const loadedAccountsMetric = new promClient.Gauge({
	name: 'pandora_directory_accounts_loaded',
	help: 'Current count of accounts loaded into memory',
});

const inUseAccountsMetric = new promClient.Gauge({
	name: 'pandora_directory_accounts_in_use',
	help: 'Current count of accounts in use',
});

const inUseCharactersMetric = new promClient.Gauge({
	name: 'pandora_directory_characters_in_use',
	help: 'Current count of characters in use',
});

/** Class that stores all currently logged in or recently used accounts, removing them when needed */
export class AccountManager {
	private onlineAccounts: Set<Account> = new Set();

	/** A tick of the manager, happens every `ACCOUNTMANAGER_TICK_INTERVAL` ms */
	private tick(): void {
		const now = Date.now();
		let inUseAccountCount = 0;
		let inUseCharacterCount = 0;
		// Go through accounts and prune old ones
		for (const account of this.onlineAccounts) {
			if (account.isInUse()) {
				inUseAccountCount++;
				account.characters.forEach((c) => {
					if (c.isInUse()) {
						inUseCharacterCount++;
					}
				});
			} else if (account.lastActivity + ACCOUNT_INACTIVITY_THRESHOLD < now) {
				this.unloadAccount(account);
			}
		}
		inUseAccountsMetric.set(inUseAccountCount);
		inUseCharactersMetric.set(inUseCharacterCount);
		DiscordBot.setOnlineStatus({
			accounts: inUseAccountCount,
			characters: inUseCharacterCount,
		});

		const db = GetDatabase();
		totalAccountsMetric.set(db.nextAccountId - 1);
		totalCharactersMetric.set(db.nextCharacterId - 1);
	}

	private interval: NodeJS.Timeout | undefined;

	/** Init the manager */
	public async init(): Promise<void> {
		if (this.interval === undefined) {
			this.interval = setInterval(this.tick.bind(this), ACCOUNTMANAGER_TICK_INTERVAL).unref();
		}
		if (AUTO_ADMIN_FIRST_USER) {
			const account = await this.loadAccountById(1);
			await account?.roles.devSetRole('admin');
		}
	}

	public onDestroy(): void {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		// Go through accounts and remove all of them
		for (const account of this.onlineAccounts) {
			this.unloadAccount(account);
		}
		inUseAccountsMetric.set(0);
	}

	/** Create account from received data, adding it to loaded accounts */
	private loadAccount(data: DatabaseAccountWithSecure): Account {
		const account = new Account(data);
		this.onlineAccounts.add(account);
		loadedAccountsMetric.set(this.onlineAccounts.size);
		logger.debug(`Loaded account ${account.data.username}`);
		return account;
	}

	/** Remove account from loaded accounts, running necessary cleanup actions */
	private unloadAccount(account: Account): void {
		logger.debug(`Unloading account ${account.data.username}`);
		this.onlineAccounts.delete(account);
		loadedAccountsMetric.set(this.onlineAccounts.size);
	}

	/**
	 * Find an account between **currently loaded accounts**, returning `null` if not found
	 */
	public getAccountById(id: number): Account | null {
		for (const account of this.onlineAccounts) {
			if (account.id === id) {
				account.touch();
				return account;
			}
		}
		return null;
	}

	/**
	 * Find an account between **currently loaded accounts**
	 * @returns The account or `null` if not found
	 */
	public getAccountByUsername(username: string): Account | null {
		username = username.toLowerCase();
		for (const account of this.onlineAccounts) {
			if (account.data.username.toLowerCase() === username) {
				account.touch();
				return account;
			}
		}
		return null;
	}

	/**
	 * Find an account between **currently loaded accounts**
	 * @returns The account or `null` if not found
	 */
	public getAccountByEmailHash(emailHash: string): Account | null {
		for (const account of this.onlineAccounts) {
			if (account.secure.verifyEmailHash(emailHash)) {
				account.touch();
				return account;
			}
		}
		return null;
	}

	/**
	 * Find an account between loaded ones or try to load it from database
	 * @returns The account or `null` if not found even in database
	 */
	public async loadAccountById(id: number): Promise<Account | null> {
		// Check if account is loaded and return it if it is
		let account = this.getAccountById(id);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountById(id);
		// Check if we didn't load it while we were querying data from DB and use already loaded if we did
		account = this.getAccountById(id);
		if (account)
			return account;
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return this.loadAccount(data);
	}

	/**
	 * Find an account between loaded ones or try to load it from database
	 * @returns The account or `null` if not found even in database
	 */
	public async loadAccountByUsername(username: string): Promise<Account | null> {
		// Check if account is loaded and return it if it is
		let account = this.getAccountByUsername(username);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountByUsername(username);
		// Check if we didn't load it while we were querying data from DB and use already loaded if we did
		account = this.getAccountByUsername(username);
		if (account)
			return account;
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return this.loadAccount(data);
	}

	/**
	 * Find an account between loaded ones or try to load it from database
	 * @returns The account or `null` if not found even in database
	 */
	public async loadAccountByEmailHash(emailHash: string): Promise<Account | null> {
		// Check if account is loaded and return it if it is
		let account = this.getAccountByEmailHash(emailHash);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountByEmailHash(emailHash);
		// Check if we didn't load it while we were querying data from DB and use already loaded if we did
		account = this.getAccountByEmailHash(emailHash);
		if (account)
			return account;
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return this.loadAccount(data);
	}

	public async createAccount(username: string, password: string, email: string): Promise<Account | 'usernameTaken' | 'emailTaken'> {
		const data = await GetDatabase().createAccount(await CreateAccountData(username, password, email));
		if (typeof data === 'string')
			return data;

		logger.info(`Registered new account ${username}`);
		const account = this.loadAccount(data);

		await account.secure.sendActivation(email);

		return account;
	}
}

/** Manager of all currently logged in or recently used accounts */
export const accountManager = new AccountManager();
