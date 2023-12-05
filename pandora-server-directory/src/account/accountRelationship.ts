import AsyncLock from 'async-lock';
import _ from 'lodash';
import { AccountId, AssertNever, GetLogger, IAccountFriendStatus, IAccountRelationship, IDirectoryClientArgument, IsNotNullable, Logger, PromiseOnce } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account } from './account';
import { accountManager } from './accountManager';
import { DatabaseAccountRelationship, DatabaseRelationship } from '../database/databaseStructure';
import { Room } from '../room/room';

const GLOBAL_LOCK = new AsyncLock();

type RelationshipCache = {
	id: AccountId;
	name: string;
	updated: number;
	relationship: DatabaseAccountRelationship;
};

export class AccountRelationship {
	public readonly account: Account;
	private readonly relationships: Map<AccountId, RelationshipCache> = new Map();
	private readonly logger: Logger;
	private lastStatus: IAccountFriendStatus | null = null;

	constructor(account: Account) {
		this.account = account;
		this.logger = GetLogger('AccountRelationship').prefixMessages(`[${account.id}]`);
		this.account.associatedConnections.onAny(() => this.updateStatus());
	}

	private get(id: AccountId): RelationshipCache | undefined {
		return this.relationships.get(id);
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

	public async getAll(): Promise<IAccountRelationship[]> {
		await this.load();
		const isNotBlockedBy = ({ relationship }: RelationshipCache) => {
			return relationship.type !== 'oneSidedBlock' || relationship.from === this.account.id;
		};

		return [...this.relationships.values()]
			.filter(isNotBlockedBy)
			.map(this.cacheToClientData.bind(this));
	}

	public async getFriendsStatus(): Promise<IAccountFriendStatus[]> {
		await this.load();
		return [...this.relationships.values()]
			.filter((rel) => rel.relationship.type === 'friend')
			.map((rel) => accountManager.getAccountById(rel.id))
			.map((acc) => acc?.relationship.getStatus())
			.filter(IsNotNullable);
	}

	public async canReceiveDM(from: Account): Promise<boolean> {
		await this.load();
		const rel = this.get(from.id);

		// No access if blocked
		if (rel?.relationship && (rel.relationship.type === 'mutualBlock' || rel.relationship.type === 'oneSidedBlock'))
			return false;

		// If allowing all, allow
		if (this.account.data.settings.allowDirectMessagesFrom === 'all')
			return true;

		// If friend, allow
		if (rel?.relationship.type === 'friend')
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

		const rel = this.get(queryingAccount.id);
		// No access if blocked
		if (rel?.relationship && (rel.relationship.type === 'mutualBlock' || rel.relationship.type === 'oneSidedBlock'))
			return false;

		// Allow access if friend
		if (rel?.relationship.type === 'friend')
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
			switch (existing.relationship.type) {
				case 'friend':
					return 'ok';
				case 'request':
					return existing.relationship.from === this.account.id ? 'ok' : 'requestAlreadyExists';
				case 'mutualBlock':
				case 'oneSidedBlock':
					return 'blocked';
				default:
					AssertNever(existing.relationship);
			}
		}
		const names = await GetDatabase().queryAccountNames([id]);
		if (!names[id]) {
			return 'accountNotFound';
		}
		await this.updateRelationship(id, { type: 'request', from: this.account.id }, names[id]);
		return 'ok';
	}

	@Synchronized
	public async acceptFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== id) {
			return 'requestNotFound';
		}
		await this.updateRelationship(id, { type: 'friend' }, existing.name);
		return 'ok';
	}

	@Synchronized
	public async declineFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== id) {
			return 'requestNotFound';
		}
		await this.updateRelationship(id, null);
		return 'ok';
	}

	@Synchronized
	public async cancelFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== this.account.id) {
			return 'requestNotFound';
		}
		await this.updateRelationship(id, null);
		return 'ok';
	}

	@Synchronized
	public async removeFriend(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'friend') {
			return false;
		}
		await this.updateRelationship(id, null);
		return true;
	}

	@Synchronized
	public async block(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing) {
			if (existing.relationship.type === 'friend')
				return false;
			if (existing.relationship.type === 'mutualBlock')
				return true;
			if (existing.relationship.type === 'oneSidedBlock' && existing.relationship.from === this.account.id)
				return true;
		} else if (await GetDatabase().getAccountById(id) == null) {
			return false;
		}
		const hasSource = existing?.relationship.type !== 'oneSidedBlock';
		await this.updateRelationship(id, hasSource
			? { type: 'oneSidedBlock', from: this.account.id }
			: { type: 'mutualBlock' });
		return true;
	}

	@Synchronized
	public async unblock(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (!existing)
			return false;
		if (existing.relationship.type !== 'mutualBlock' && existing.relationship.type !== 'oneSidedBlock')
			return false;
		if (existing.relationship.type === 'oneSidedBlock' && existing.relationship.from !== this.account.id)
			return false;

		if (existing.relationship.type === 'oneSidedBlock') {
			await this.updateRelationship(id, null);
		} else {
			await this.updateRelationship(id, { type: 'oneSidedBlock', from: id });
		}
		return true;
	}

	private async update(rel: DatabaseRelationship, name?: string): Promise<void> {
		const id = rel.accounts[0] === this.account.id ? rel.accounts[1] : rel.accounts[0];
		const existing = this.get(id);
		name ??= existing ? existing.name : (await GetDatabase().queryAccountNames([id]))[id];
		if (!name) {
			this.logger.warning(`Could not find name for account ${id}`);
			return;
		}
		this.setRelationship(id, name, rel.updated, rel.relationship);
		const newRel = this.get(id);
		if (!newRel)
			return;
		if (existing?.relationship.type === 'oneSidedBlock' && existing.relationship.from === this.account.id && newRel.relationship.type === 'mutualBlock')
			return;
		if (newRel.relationship.type === 'oneSidedBlock' && newRel.relationship.from === this.account.id && existing?.relationship.type === 'mutualBlock')
			return;
		if (!existing && newRel.relationship.type === 'oneSidedBlock' && newRel.relationship.from !== this.account.id)
			return;

		if (existing?.relationship.type === 'mutualBlock' && newRel.relationship.type === 'oneSidedBlock') {
			this.account.associatedConnections.sendMessage('relationshipsUpdate', {
				relationship: { id, type: 'none' },
				friendStatus: { id, online: 'delete' },
			});
			return;
		}
		let friendStatus: IDirectoryClientArgument['relationshipsUpdate']['friendStatus'] = { id, online: 'delete' };
		if (newRel.relationship.type === 'friend') {
			const friendAccount = accountManager.getAccountById(id);
			const actualStatus = friendAccount?.relationship.getStatus();
			if (actualStatus != null) {
				friendStatus = actualStatus;
			}
		}
		this.account.associatedConnections.sendMessage('relationshipsUpdate', {
			relationship: this.cacheToClientData(newRel),
			friendStatus,
		});
	}

	private remove(id: AccountId): void {
		const existing = this.get(id);
		this.relationships.delete(id);
		if (existing?.relationship.type === 'oneSidedBlock' && existing.relationship.from === id) {
			return;
		}
		this.account.associatedConnections.sendMessage('relationshipsUpdate', {
			relationship: { id, type: 'none' },
			friendStatus: { id, online: 'delete' },
		});
	}

	private loaded = false;
	protected load = PromiseOnce(() => this._load());

	private async _load(): Promise<void> {
		if (this.loaded) {
			return;
		}
		const relationships = await GetDatabase().getRelationships(this.account.id);
		const ids = relationships.map((rel) => rel.accounts[0] === this.account.id ? rel.accounts[1] : rel.accounts[0]);
		const names = await GetDatabase().queryAccountNames(_.uniq(ids));
		for (const rel of relationships) {
			const id = rel.accounts[0] === this.account.id ? rel.accounts[1] : rel.accounts[0];
			const name = names[id];
			if (!name) {
				this.logger.warning(`Could not find name for account ${id}`);
				continue;
			}
			this.setRelationship(id, name, rel.updated, rel.relationship);
		}
		this.loaded = true;
		this.updateStatus();
	}

	private async updateRelationship(other: AccountId, relationship: DatabaseAccountRelationship | null, otherName?: string) {
		if (relationship == null) {
			await GetDatabase().removeRelationship(this.account.id, other);
			this.remove(other);
			accountManager.getAccountById(other)?.relationship.remove(this.account.id);
			return;
		}
		const rel = await GetDatabase().setRelationship(this.account.id, other, relationship);
		await this.update(rel, otherName);
		await accountManager.getAccountById(other)?.relationship.update(rel, this.account.username);
	}

	private setRelationship(id: AccountId, name: string, updated: number, relationship: DatabaseAccountRelationship): void {
		this.relationships.set(id, {
			id,
			name,
			updated,
			relationship,
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
			const rel = this.get(account.id);
			if (!rel || rel.relationship.type !== 'friend') {
				continue;
			}
			account.associatedConnections.sendMessage('friendStatus', data);
		}
	}

	private cacheToClientData({ id, name, updated, relationship }: RelationshipCache): IAccountRelationship {
		let type: IAccountRelationship['type'];
		switch (relationship.type) {
			case 'friend':
				type = 'friend';
				break;
			case 'oneSidedBlock':
			case 'mutualBlock':
				type = 'blocked';
				break;
			case 'request':
				type = relationship.from === this.account.id ? 'pending' : 'incoming';
				break;
			default:
				AssertNever(relationship);
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
	method: (this: AccountRelationship, id: AccountId) => Promise<ReturnT>,
	_context: ClassMethodDecoratorContext<AccountRelationship>,
) {
	return async function (this: AccountRelationship, id: AccountId) {
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
