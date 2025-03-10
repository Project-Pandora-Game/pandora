import { diffString } from 'json-diff';
import { isEqual, omit, pick } from 'lodash-es';
import { Assert, AssertNotNullable, AsyncSynchronized, GetLogger, ServerService } from 'pandora-common';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider.ts';
import { DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, DatabaseAccountWithSecure, DatabaseAccountWithSecureSchema } from '../database/databaseStructure.ts';
import { AUDIT_LOG } from '../logging.ts';
import { DiscordBot } from '../services/discord/discordBot.ts';
import { Account, CreateAccountData } from './account.ts';

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
export class AccountManager implements ServerService {
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
	private async _loadAccount(rawData: DatabaseAccountWithSecure): Promise<Account | null> {
		// If there already is account matching this id loaded, simply return it
		const loadedAccount = this.getAccountById(rawData.id);
		if (loadedAccount) {
			return loadedAccount;
		}

		// Verify and migrate account data
		rawData = omit(rawData, '_id');
		const parsedData = DatabaseAccountWithSecureSchema.safeParse(rawData);
		if (!parsedData.success) {
			logger.error(`Failed to load account ${rawData.id}: `, parsedData.error);
			return null;
		}
		// Save data modified by migration and catches
		if (!isEqual(parsedData.data, rawData)) {
			const diff = diffString(rawData, parsedData.data, { color: false });
			logger.warning(`Account ${parsedData.data.id} has invalid data, fixing...\n`, diff);
			await GetDatabase().updateAccountData(parsedData.data.id, pick(parsedData.data, ...DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES));
		}

		// Get list of the account's characters
		const characters = await GetDatabase().getCharactersForAccount(parsedData.data.id);

		const account = new Account(parsedData.data, characters);
		this._onlineAccounts.add(account);
		loadedAccountsMetric.set(this._onlineAccounts.size);
		logger.debug(`Loaded account ${account.data.username}`);
		return account;
	}

	/** Remove account from loaded accounts, running necessary cleanup actions */
	private unloadAccount(account: Account): void {
		Assert(!account.isInUse());
		logger.debug(`Unloading account ${account.data.username}`);
		account.onUnload();
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
		if (account) {
			return account;
		}
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

	public async createAccount(username: string, displayName: string, password: string, email: string): Promise<Account | 'usernameTaken' | 'emailTaken'> {
		const data = await GetDatabase().createAccount(await CreateAccountData(username, displayName, password, email));
		if (typeof data === 'string')
			return data;

		AUDIT_LOG.info(`Registered new account. id=${data.id} username="${username}"`);
		const account = await this._loadAccount(data);
		AssertNotNullable(account);

		await account.secure.sendActivation(email);

		return account;
	}
}

/** Manager of all currently logged in or recently used accounts */
export const accountManager = new AccountManager();
