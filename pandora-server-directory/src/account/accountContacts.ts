import AsyncLock from 'async-lock';
import _ from 'lodash';
import { AccountId, AssertNever, GetLogger, IAccountFriendStatus, IAccountContact, IDirectoryClientArgument, IsNotNullable, Logger, PromiseOnce } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account } from './account';
import { accountManager } from './accountManager';
import { DatabaseAccountContact, DatabaseAccountContactType } from '../database/databaseStructure';
import { Room } from '../room/room';

const GLOBAL_LOCK = new AsyncLock();

type AccountContactCache = {
	id: AccountId;
	name: string;
	updated: number;
	contact: DatabaseAccountContactType;
};

export class AccountContacts {
	public readonly account: Account;
	private readonly contacts: Map<AccountId, AccountContactCache> = new Map();
	private readonly logger: Logger;
	private lastStatus: IAccountFriendStatus | null = null;

	constructor(account: Account) {
		this.account = account;
		this.logger = GetLogger('AccountContacts').prefixMessages(`[${account.id}]`);
		this.account.associatedConnections.onAny(() => this.updateStatus());
	}

	private get(id: AccountId): AccountContactCache | undefined {
		return this.contacts.get(id);
	}

	private getStatus(): IAccountFriendStatus | null {
		if (!this.loaded) {
			return null;
		}
		const showStatus = !this.account.data.settings.hideOnlineStatus;
		const online = showStatus && this.account.isOnline();
		return {
			id: this.account.id,
			labelColor: this.account.data.settings.labelColor,
			online,
			characters: !online ? [] : (
				[...this.account.characters.values()]
					.filter((char) => char.isOnline())
					.map((char) => ({
						id: char.id,
						name: char.data.name,
						inRoom: char.loadedCharacter?.room?.isPublic ? char.loadedCharacter.room.id : undefined,
					}))
			),
		};
	}

	public async getAll(): Promise<IAccountContact[]> {
		await this.load();
		const isNotBlockedBy = ({ contact }: AccountContactCache) => {
			return contact.type !== 'oneSidedBlock' || contact.from === this.account.id;
		};

		return [...this.contacts.values()]
			.filter(isNotBlockedBy)
			.map(this.cacheToClientData.bind(this));
	}

	public async getFriendsStatus(): Promise<IAccountFriendStatus[]> {
		await this.load();
		return [...this.contacts.values()]
			.filter((contact) => contact.contact.type === 'friend')
			.map((contact) => accountManager.getAccountById(contact.id))
			.map((acc) => acc?.contacts.getStatus())
			.filter(IsNotNullable);
	}

	public async canReceiveDM(from: Account): Promise<boolean> {
		await this.load();
		const { contact } = this.get(from.id) ?? {};

		// No access if blocked
		if (contact && (contact.type === 'mutualBlock' || contact.type === 'oneSidedBlock'))
			return false;

		// If allowing all, allow
		if (this.account.data.settings.allowDirectMessagesFrom === 'all')
			return true;

		// If friend, allow
		if (contact?.type === 'friend')
			return true;

		// If allowing from the same room and accounts share a room, allow
		if (this.account.data.settings.allowDirectMessagesFrom === 'room' && AccountsHaveCharacterInSameRoom(this.account, from))
			return true;

		// Default: No access
		return false;
	}

	/**
	 * Checks if this account's profile is visible to the passed account
	 * @param queryingAccount - The account attempting to access this account's profile
	 * @returns - If the access should be allowed
	 */
	public async profileVisibleTo(queryingAccount: Account): Promise<boolean> {
		await this.load();

		// Player can always see their own profile
		if (this.account.id === queryingAccount.id)
			return true;

		// Moderators can see anyone's profile
		if (queryingAccount.roles.isAuthorized('moderator'))
			return true;

		const { contact } = this.get(queryingAccount.id) ?? {};
		// No access if blocked
		if (contact && (contact.type === 'mutualBlock' || contact.type === 'oneSidedBlock'))
			return false;

		// Allow access if friend
		if (contact?.type === 'friend')
			return true;

		// Allow access if both are in the same room with any character
		if (AccountsHaveCharacterInSameRoom(this.account, queryingAccount))
			return true;

		// Default: No access
		return false;
	}

	@Synchronized
	public async initiateFriendRequest(id: AccountId): Promise<'ok' | 'accountNotFound' | 'blocked' | 'requestAlreadyExists'> {
		const existing = this.get(id);
		if (existing) {
			switch (existing.contact.type) {
				case 'friend':
					return 'ok';
				case 'request':
					return existing.contact.from === this.account.id ? 'ok' : 'requestAlreadyExists';
				case 'mutualBlock':
				case 'oneSidedBlock':
					return 'blocked';
				default:
					AssertNever(existing.contact);
			}
		}
		const names = await GetDatabase().queryAccountNames([id]);
		if (!names[id]) {
			return 'accountNotFound';
		}
		await this.updateAccountContact(id, { type: 'request', from: this.account.id }, names[id]);
		return 'ok';
	}

	@Synchronized
	public async acceptFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.contact.type !== 'request' || existing.contact.from !== id) {
			return 'requestNotFound';
		}
		await this.updateAccountContact(id, { type: 'friend' }, existing.name);
		return 'ok';
	}

	@Synchronized
	public async declineFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.contact.type !== 'request' || existing.contact.from !== id) {
			return 'requestNotFound';
		}
		await this.updateAccountContact(id, null);
		return 'ok';
	}

	@Synchronized
	public async cancelFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.contact.type !== 'request' || existing.contact.from !== this.account.id) {
			return 'requestNotFound';
		}
		await this.updateAccountContact(id, null);
		return 'ok';
	}

	@Synchronized
	public async removeFriend(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.contact.type !== 'friend') {
			return false;
		}
		await this.updateAccountContact(id, null);
		return true;
	}

	@Synchronized
	public async block(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing) {
			if (existing.contact.type === 'friend')
				return false;
			if (existing.contact.type === 'mutualBlock')
				return true;
			if (existing.contact.type === 'oneSidedBlock' && existing.contact.from === this.account.id)
				return true;
		} else if (await GetDatabase().getAccountById(id) == null) {
			return false;
		}
		const hasSource = existing?.contact.type !== 'oneSidedBlock';
		await this.updateAccountContact(id, hasSource
			? { type: 'oneSidedBlock', from: this.account.id }
			: { type: 'mutualBlock' });
		return true;
	}

	@Synchronized
	public async unblock(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (!existing)
			return false;
		if (existing.contact.type !== 'mutualBlock' && existing.contact.type !== 'oneSidedBlock')
			return false;
		if (existing.contact.type === 'oneSidedBlock' && existing.contact.from !== this.account.id)
			return false;

		if (existing.contact.type === 'oneSidedBlock') {
			await this.updateAccountContact(id, null);
		} else {
			await this.updateAccountContact(id, { type: 'oneSidedBlock', from: id });
		}
		return true;
	}

	private async update(contact: DatabaseAccountContact, name?: string): Promise<void> {
		const id = contact.accounts[0] === this.account.id ? contact.accounts[1] : contact.accounts[0];
		const existing = this.get(id);
		name ??= existing ? existing.name : (await GetDatabase().queryAccountNames([id]))[id];
		if (!name) {
			this.logger.warning(`Could not find name for account ${id}`);
			return;
		}
		this.setAccountContact(id, name, contact.updated, contact.contact);
		const newContact = this.get(id);
		if (!newContact)
			return;
		if (existing?.contact.type === 'oneSidedBlock' && existing.contact.from === this.account.id && newContact.contact.type === 'mutualBlock')
			return;
		if (newContact.contact.type === 'oneSidedBlock' && newContact.contact.from === this.account.id && existing?.contact.type === 'mutualBlock')
			return;
		if (!existing && newContact.contact.type === 'oneSidedBlock' && newContact.contact.from !== this.account.id)
			return;

		if (existing?.contact.type === 'mutualBlock' && newContact.contact.type === 'oneSidedBlock') {
			this.account.associatedConnections.sendMessage('accountContactUpdate', {
				contact: { id, type: 'none' },
				friendStatus: { id, online: 'delete' },
			});
			return;
		}
		let friendStatus: IDirectoryClientArgument['accountContactUpdate']['friendStatus'] = { id, online: 'delete' };
		if (newContact.contact.type === 'friend') {
			const friendAccount = accountManager.getAccountById(id);
			const actualStatus = friendAccount?.contacts.getStatus();
			if (actualStatus != null) {
				friendStatus = actualStatus;
			}
		}
		this.account.associatedConnections.sendMessage('accountContactUpdate', {
			contact: this.cacheToClientData(newContact),
			friendStatus,
		});
	}

	private remove(id: AccountId): void {
		const existing = this.get(id);
		this.contacts.delete(id);
		if (existing?.contact.type === 'oneSidedBlock' && existing.contact.from === id) {
			return;
		}
		this.account.associatedConnections.sendMessage('accountContactUpdate', {
			contact: { id, type: 'none' },
			friendStatus: { id, online: 'delete' },
		});
	}

	private loaded = false;
	protected load = PromiseOnce(() => this._load());

	private async _load(): Promise<void> {
		if (this.loaded) {
			return;
		}
		const contacts = await GetDatabase().getAccountContacts(this.account.id);
		const ids = contacts.map((contact) => contact.accounts[0] === this.account.id ? contact.accounts[1] : contact.accounts[0]);
		const names = await GetDatabase().queryAccountNames(_.uniq(ids));
		for (const contact of contacts) {
			const id = contact.accounts[0] === this.account.id ? contact.accounts[1] : contact.accounts[0];
			const name = names[id];
			if (!name) {
				this.logger.warning(`Could not find name for account ${id}`);
				continue;
			}
			this.setAccountContact(id, name, contact.updated, contact.contact);
		}
		this.loaded = true;
		this.updateStatus();
	}

	private async updateAccountContact(other: AccountId, type: DatabaseAccountContactType | null, otherName?: string) {
		if (type == null) {
			await GetDatabase().removeAccountContact(this.account.id, other);
			this.remove(other);
			accountManager.getAccountById(other)?.contacts.remove(this.account.id);
			return;
		}
		const contact = await GetDatabase().setAccountContact(this.account.id, other, type);
		await this.update(contact, otherName);
		await accountManager.getAccountById(other)?.contacts.update(contact, this.account.username);
	}

	private setAccountContact(id: AccountId, name: string, updated: number, contact: DatabaseAccountContactType): void {
		this.contacts.set(id, {
			id,
			name,
			updated,
			contact,
		});
	}

	public updateStatus(): void {
		const status = this.getStatus();
		if (_.isEqual(status, this.lastStatus)) {
			return;
		}
		this.lastStatus = status;
		const data = status == null ? { id: this.account.id, online: 'delete' } as const : status;
		for (const account of accountManager.onlineAccounts) {
			if (account.id === this.account.id) {
				continue;
			}
			const contact = this.get(account.id);
			if (!contact || contact.contact.type !== 'friend') {
				continue;
			}
			account.associatedConnections.sendMessage('friendStatus', data);
		}
	}

	private cacheToClientData({ id, name, updated, contact }: AccountContactCache): IAccountContact {
		let type: IAccountContact['type'];
		switch (contact.type) {
			case 'friend':
				type = 'friend';
				break;
			case 'oneSidedBlock':
			case 'mutualBlock':
				type = 'blocked';
				break;
			case 'request':
				type = contact.from === this.account.id ? 'pending' : 'incoming';
				break;
			default:
				AssertNever(contact);
		}
		return {
			id,
			name,
			time: updated,
			type,
		};
	}
}

function Synchronized<ReturnT>(
	method: (this: AccountContacts, id: AccountId) => Promise<ReturnT>,
	_context: ClassMethodDecoratorContext<AccountContacts>,
) {
	return async function (this: AccountContacts, id: AccountId) {
		await this.load();
		const [a, b] = [this.account.id, id].sort();
		return await GLOBAL_LOCK.acquire(`${a}-${b}`, () => method.call(this, id));
	};
}

/**
 * Checks whether there is a room in which both accounts have a character.
 * Note, that at least one of the characters in said room needs to be loaded for it to count.
 * @param account1 - The account to check
 * @param account2 - The account to check
 * @returns `true`, if there is a common room, `false` otherwise
 */
function AccountsHaveCharacterInSameRoom(account1: Account, account2: Account): boolean {
	const account1Rooms = new Set<Room>();

	for (const char of account1.characters.values()) {
		const room = char.loadedCharacter?.room;
		if (room != null) {
			account1Rooms.add(room);
		}
	}
	for (const char of account2.characters.values()) {
		const room = char?.loadedCharacter?.room;
		if (room != null && account1Rooms.has(room)) {
			return true;
		}
	}
	return false;
}