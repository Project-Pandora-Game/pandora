import { GetDatabase } from '../database/databaseProvider';
import { GetLogger } from 'pandora-common/dist/logging';
import { Account, CreateAccountData } from './account';

/** Time (in ms) after which manager prunes account without any active connection */
const ACCOUNT_INACTIVITY_THRESHOLD = 60_000;
/** Time (in ms) of how often manager checks for accounts to prune */
const ACCOUNTMANAGER_TICK_INTERVAL = 15_000;

const logger = GetLogger('AccountManager');

/** Class that stores all currently logged in or recently used accounts, removing them when needed */
export class AccountManager {
	private onlineAccounts: Set<Account> = new Set();

	/** A tick of the manager, happens every `ACCOUNTMANAGER_TICK_INTERVAL` ms */
	private tick(): void {
		const now = Date.now();
		// Go through accounts and prune old ones
		for (const account of this.onlineAccounts) {
			if (account.associatedConnections.size === 0 && account.lastActivity + ACCOUNT_INACTIVITY_THRESHOLD < now) {
				this.unloadAccount(account);
			}
		}
	}

	/** Init the manager; **can only be used once** */
	public init(): void {
		setInterval(this.tick.bind(this), ACCOUNTMANAGER_TICK_INTERVAL).unref();
	}

	/** Create account from received data, adding it to loaded accounts */
	private loadAccount(data: DatabaseAccountWithSecure): Account {
		const account = new Account(data);
		this.onlineAccounts.add(account);
		logger.debug(`Loaded account ${account.data.username}`);
		return account;
	}

	/** Remove account from loaded accounts, running necessary cleanup actions */
	private unloadAccount(account: Account): void {
		logger.debug(`Unloading account ${account.data.username}`);
		this.onlineAccounts.delete(account);
	}

	/**
	 * Find an account between **currently loaded accounts**, returning `null` if not found
	 */
	public getAccountById(id: number): Account | null {
		for (const account of this.onlineAccounts) {
			if (account.data.id === id) {
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

export function InitAccountManager(): void {
	accountManager.init();
}
