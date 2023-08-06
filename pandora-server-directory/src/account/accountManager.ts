import { GetDatabase } from '../database/databaseProvider';
import { ACCOUNT_SETTINGS_DEFAULT, Assert, AsyncSynchronized, DirectoryAccountSettingsSchema, GetLogger } from 'pandora-common';
import { Account, CreateAccountData } from './account';
import promClient from 'prom-client';
import { DiscordBot } from '../services/discord/discordBot';
import { cloneDeep, isEqual } from 'lodash';
import { diffString } from 'json-diff';

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

const onlineAccountsMetric = new promClient.Gauge({
	name: 'pandora_directory_accounts_online',
	help: 'Current count of accounts considered online',
});

const inUseCharactersMetric = new promClient.Gauge({
	name: 'pandora_directory_characters_in_use',
	help: 'Current count of characters in use',
});

const onlineCharactersMetric = new promClient.Gauge({
	name: 'pandora_directory_characters_online',
	help: 'Current count of characters considered online',
});

/** Class that stores all currently logged in or recently used accounts, removing them when needed */
export class AccountManager {
	private readonly _onlineAccounts: Set<Account> = new Set();
	public get onlineAccounts(): ReadonlySet<Account> {
		return this._onlineAccounts;
	}

	public getOnlineCounts(): {
		inUseAccounts: number;
		onlineAccounts: number;
		inUseCharacters: number;
		onlineCharacters: number;
	} {
		let inUseAccounts = 0;
		let onlineAccounts = 0;
		let inUseCharacters = 0;
		let onlineCharacters = 0;
		for (const account of this._onlineAccounts) {
			if (account.isInUse()) {
				inUseAccounts++;
			}
			if (account.isOnline()) {
				onlineAccounts++;
			}
			account.characters.forEach((c) => {
				if (c.isInUse()) {
					inUseCharacters++;
				}
				if (c.isOnline()) {
					onlineCharacters++;
				}
			});
		}
		return { inUseAccounts, onlineAccounts, inUseCharacters, onlineCharacters };
	}

	/** A tick of the manager, happens every `ACCOUNTMANAGER_TICK_INTERVAL` ms */
	private tick(): void {
		const now = Date.now();
		// Go through accounts and prune old ones
		for (const account of this._onlineAccounts) {
			if (!account.isInUse() && account.lastActivity + ACCOUNT_INACTIVITY_THRESHOLD < now) {
				this.unloadAccount(account);
			}
		}

		// Update metrics
		const { inUseAccounts, onlineAccounts, inUseCharacters, onlineCharacters } = this.getOnlineCounts();
		inUseAccountsMetric.set(inUseAccounts);
		onlineAccountsMetric.set(onlineAccounts);
		inUseCharactersMetric.set(inUseCharacters);
		onlineCharactersMetric.set(onlineCharacters);
		DiscordBot.setOnlineStatus({
			accounts: onlineAccounts,
			characters: onlineCharacters,
		});

		const db = GetDatabase();
		totalAccountsMetric.set(db.nextAccountId - 1);
		totalCharactersMetric.set(db.nextCharacterId - 1);
	}

	private interval: NodeJS.Timeout | undefined;

	/** Init the manager */
	public init(): void {
		if (this.interval === undefined) {
			this.interval = setInterval(this.tick.bind(this), ACCOUNTMANAGER_TICK_INTERVAL).unref();
		}
	}

	public async onDestroyCharacters(): Promise<void> {
		// Go through accounts and run disconnection
		for (const account of this._onlineAccounts) {
			await account.onManagerDestroy();
		}
		inUseCharactersMetric.set(0);
		onlineCharactersMetric.set(0);
	}

	public onDestroyAccounts(): void {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		// Go through accounts and remove all of them
		for (const account of this._onlineAccounts) {
			this.unloadAccount(account);
		}
		inUseAccountsMetric.set(0);
		onlineAccountsMetric.set(0);
	}

	/** Create account from received data, adding it to loaded accounts */
	@AsyncSynchronized()
	private async _loadAccount(data: DatabaseAccountWithSecure): Promise<Account> {
		// If there already is account matching this id loaded, simply return it
		const loadedAccount = this.getAccountById(data.id);
		if (loadedAccount)
			return loadedAccount;

		// Verify and migrate account data

		// Settings migration
		{
			const parsedSettings = DirectoryAccountSettingsSchema.safeParse(data.settings);
			const newSettings = parsedSettings.success ? parsedSettings.data : cloneDeep(ACCOUNT_SETTINGS_DEFAULT);
			if (!isEqual(newSettings, data.settings)) {
				// Save modified data
				const diff = diffString(data.settings, newSettings, { color: false });
				logger.warning(`Account ${data.id} has invalid settings, fixing...\n`, diff);
				await GetDatabase().updateAccountSettings(data.id, newSettings);
				data.settings = newSettings;
			}
		}

		const account = new Account(data);
		this._onlineAccounts.add(account);
		loadedAccountsMetric.set(this._onlineAccounts.size);
		logger.debug(`Loaded account ${account.data.username}`);
		return account;
	}

	/** Remove account from loaded accounts, running necessary cleanup actions */
	private unloadAccount(account: Account): void {
		Assert(!account.isInUse());
		logger.debug(`Unloading account ${account.data.username}`);
		this._onlineAccounts.delete(account);
		loadedAccountsMetric.set(this._onlineAccounts.size);
	}

	/**
	 * Find an account between **currently loaded accounts**, returning `null` if not found
	 */
	public getAccountById(id: number): Account | null {
		for (const account of this._onlineAccounts) {
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
		for (const account of this._onlineAccounts) {
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
		for (const account of this._onlineAccounts) {
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
		const account = this.getAccountById(id);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountById(id);
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return await this._loadAccount(data);
	}

	/**
	 * Find an account between loaded ones or try to load it from database
	 * @returns The account or `null` if not found even in database
	 */
	public async loadAccountByUsername(username: string): Promise<Account | null> {
		// Check if account is loaded and return it if it is
		const account = this.getAccountByUsername(username);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountByUsername(username);
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return await this._loadAccount(data);
	}

	/**
	 * Find an account between loaded ones or try to load it from database
	 * @returns The account or `null` if not found even in database
	 */
	public async loadAccountByEmailHash(emailHash: string): Promise<Account | null> {
		// Check if account is loaded and return it if it is
		const account = this.getAccountByEmailHash(emailHash);
		if (account)
			return account;
		// Get it from database
		const data = await GetDatabase().getAccountByEmailHash(emailHash);
		// Use the acquired DB data to load character
		if (!data)
			return null;
		return await this._loadAccount(data);
	}

	public async createAccount(username: string, password: string, email: string): Promise<Account | 'usernameTaken' | 'emailTaken'> {
		const data = await GetDatabase().createAccount(await CreateAccountData(username, password, email));
		if (typeof data === 'string')
			return data;

		logger.info(`Registered new account ${username}`);
		const account = await this._loadAccount(data);

		await account.secure.sendActivation(email);

		return account;
	}
}

/** Manager of all currently logged in or recently used accounts */
export const accountManager = new AccountManager();
