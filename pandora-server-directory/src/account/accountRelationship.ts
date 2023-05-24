import AsyncLock from 'async-lock';
import _ from 'lodash';
import { AccountId, AssertNever, AssertNotNullable, GetLogger, IAccountFriendStatus, IAccountRelationship, Logger, PromiseOnce } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account } from './account';
import { accountManager } from './accountManager';

const logger = GetLogger('AccountRelationship');

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
		this.logger = logger.prefixMessages(`[${account.id}]`);
		this.account.associatedConnections.onAny(this.onConnection.bind(this));
	}

	private get(id: AccountId): RelationshipCache | undefined {
		return this.relationships.get(id);
	}

	private getStatus(): IAccountFriendStatus | null {
		if (!this.loaded) {
			return null;
		}
		if (this.account.data.settings.hideOnlineStatus) {
			return null;
		}
		return {
			id: this.account.id,
			online: this.account.associatedConnections.hasClients(),
			characters: [...this.account.characters.values()]
				.filter((char) => !!char.assignedConnection)
				.map((char) => ({
					id: char.id,
					name: char.data.name,
					inRoom: char.room?.isPublic ? char.room.id : undefined,
				})),
		};
	}

	public async getAll(): Promise<IAccountRelationship[]> {
		await this.load();
		const isNotBlockedBy = ({ relationship }: RelationshipCache) => {
			return relationship.type !== 'oneSidedBlock' || relationship.from === this.account.id;
		};
		const cacheToClientData = ({ id, name, updated, relationship }: RelationshipCache): IAccountRelationship => {
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
		};
		return [...this.relationships.values()]
			.filter(isNotBlockedBy)
			.map(cacheToClientData);
	}

	public async getAllStatus(): Promise<IAccountFriendStatus[]> {
		await this.load();
		return [...this.relationships.values()]
			.filter((rel) => rel.relationship.type === 'friend')
			.map((rel) => accountManager.getAccountById(rel.id))
			.map((acc) => acc?.relationship.getStatus())
			.filter((status): status is IAccountFriendStatus => !!status);
	}

	public async canReceiveDM(from: Account): Promise<boolean> {
		await this.load();
		const rel = this.get(from.id);
		if (rel?.relationship && (rel.relationship.type === 'mutualBlock' || rel.relationship.type === 'oneSidedBlock')) {
			return false;
		}
		if (this.account.data.settings.allowDirectMessagesFrom === 'all') {
			return true;
		}
		if (rel?.relationship.type === 'friend') {
			return true;
		}
		for (const char of this.account.characters.values()) {
			if (!char.room) continue;
			for (const char2 of from.characters.values()) {
				if (char.room.id === char2.room?.id) {
					return true;
				}
			}
		}
		return false;
	}

	@Synchronized()
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
		const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'request', from: this.account.id });
		await this.update(rel, names[id]);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return 'ok';
	}

	@Synchronized()
	public async acceptFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== id) {
			return 'requestNotFound';
		}
		const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'friend' });
		await this.update(rel, existing.name);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return 'ok';
	}

	@Synchronized()
	public async declineFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== id) {
			return 'requestNotFound';
		}
		await GetDatabase().removeRelationship(this.account.id, id);
		this.remove(id);
		accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		return 'ok';
	}

	@Synchronized()
	public async cancelFriendRequest(id: AccountId): Promise<'ok' | 'requestNotFound'> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'request' || existing.relationship.from !== this.account.id) {
			return 'requestNotFound';
		}
		await GetDatabase().removeRelationship(this.account.id, id);
		this.remove(id);
		accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		return 'ok';
	}

	@Synchronized()
	public async removeFriend(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.relationship.type !== 'friend') {
			return false;
		}
		await GetDatabase().removeRelationship(this.account.id, id);
		this.remove(id);
		accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		return true;
	}

	@Synchronized()
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
		const rel = await GetDatabase().setRelationship(this.account.id, id, hasSource
			? { type: 'oneSidedBlock', from: this.account.id }
			: { type: 'mutualBlock' });
		await this.update(rel);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return true;
	}

	@Synchronized()
	public async unblock(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (!existing)
			return false;
		if (existing.relationship.type !== 'mutualBlock' && existing.relationship.type !== 'oneSidedBlock')
			return false;
		if (existing.relationship.type === 'oneSidedBlock' && existing.relationship.from !== this.account.id)
			return false;

		if (existing.relationship.type === 'oneSidedBlock') {
			await GetDatabase().removeRelationship(this.account.id, id);
			this.remove(id);
			accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		} else {
			const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'oneSidedBlock', from: id });
			await this.update(rel);
			await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
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
			this.account.associatedConnections.sendMessage('relationshipsUpdate', { id });
			return;
		}
		this.account.associatedConnections.sendMessage('relationshipsUpdate', newRel);
	}

	private remove(id: AccountId): void {
		const existing = this.get(id);
		this.relationships.delete(id);
		if (existing?.relationship.type === 'oneSidedBlock' && existing.relationship.from === id) {
			return;
		}
		this.account.associatedConnections.sendMessage('relationshipsUpdate', { id });
	}

	private loaded = false;
	private load = PromiseOnce(() => this._load());

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

	private setRelationship(id: AccountId, name: string, updated: number, relationship: DatabaseAccountRelationship): void {
		this.relationships.set(id, {
			id,
			name,
			updated,
			relationship,
		});
	}

	private onConnection(): void {
		if (!this.loaded) {
			return;
		}
		this.updateStatus();
	}

	public updateStatus(): void {
		const status = this.getStatus();
		if (_.isEqual(status, this.lastStatus)) {
			return;
		}
		this.lastStatus = status;
		const data = status == null ? { id: this.account.id } : status;
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
}

function Synchronized() {
	return function <ReturnT>(_target: AccountRelationship, _propertyKey: string, descriptor: TypedPropertyDescriptor<(id: AccountId) => Promise<ReturnT>>) {
		const original = descriptor.value;
		AssertNotNullable(original);
		descriptor.value = async function (this: AccountRelationship, id: AccountId) {
			// @ts-expect-error private
			await this.load();
			const [a, b] = [this.account.id, id].sort();
			return await GLOBAL_LOCK.acquire(`${a}-${b}`, () => original.call(this, id));
		};
		return descriptor;
	};
}
