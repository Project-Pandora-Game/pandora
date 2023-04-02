import AsyncLock from 'async-lock';
import _ from 'lodash';
import { AccountId, AssertNever, AssertNotNullable, GetLogger, IAccountRelationship, Logger } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account } from './account';
import { accountManager } from './accountManager';

const logger = GetLogger('AccountRelationship');

const GLOBAL_LOCK = new AsyncLock();

export class AccountRelationship {
	public readonly account: Account;
	private readonly relationships: Map<AccountId, IAccountRelationship<'blockedBy' | 'blockMutual'>> = new Map();
	private readonly logger: Logger;

	constructor(account: Account) {
		this.account = account;
		this.logger = logger.prefixMessages(`[${account.id}]`);
	}

	private get(id: AccountId): IAccountRelationship<'blockedBy' | 'blockMutual'> | undefined {
		return this.relationships.get(id);
	}

	public async getAll(): Promise<IAccountRelationship[]> {
		await this.load();
		return [...this.relationships.values()]
			.filter(RemoveBlockedBy)
			.map(CastMutualToSimple);
	}

	@Synchronized()
	public async initiateFriendRequest(id: AccountId): Promise<'ok' | 'accountNotFound' | 'blocked' | 'requestAlreadyExists'> {
		const existing = this.get(id);
		if (existing) {
			switch (existing.type) {
				case 'friend':
				case 'pending':
					return 'ok';
				case 'incoming':
					return 'requestAlreadyExists';
				case 'blocked':
				case 'blockedBy':
				case 'blockMutual':
					return 'blocked';
				default:
					AssertNever(existing.type);
			}
		}
		const names = await GetDatabase().queryAccountNames([id]);
		if (!names[id]) {
			return 'accountNotFound';
		}
		const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'request', source: this.account.id });
		await this.update(rel, names[id]);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return 'ok';
	}

	@Synchronized()
	public async acceptFriendRequest(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.type !== 'incoming') {
			return false;
		}
		const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'friend' });
		await this.update(rel, existing.name);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return true;
	}

	@Synchronized()
	public async declineFriendRequest(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.type !== 'incoming') {
			return false;
		}
		await GetDatabase().removeRelationship(this.account.id, id);
		this.remove(id);
		accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		return true;
	}

	@Synchronized()
	public async cancelFriendRequest(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.type !== 'pending') {
			return false;
		}
		await GetDatabase().removeRelationship(this.account.id, id);
		this.remove(id);
		accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		return true;
	}

	@Synchronized()
	public async removeFriend(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (existing?.type !== 'friend') {
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
			if (existing.type === 'blocked' || existing.type === 'blockMutual')
				return true;
			if (existing.type === 'friend') {
				return false;
			}
		} else if (await GetDatabase().getAccountById(id) == null) {
			return false;
		}
		const hasSource = existing?.type === 'blockedBy';
		const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'block', source: hasSource ? this.account.id : undefined });
		await this.update(rel);
		await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		return true;
	}

	@Synchronized()
	public async unblock(id: AccountId): Promise<boolean> {
		const existing = this.get(id);
		if (!existing || (existing.type !== 'blocked' && existing.type !== 'blockMutual')) {
			return false;
		}
		if (existing.type === 'blocked') {
			await GetDatabase().removeRelationship(this.account.id, id);
			this.remove(id);
			accountManager.getAccountById(id)?.relationship.remove(this.account.id);
		} else {
			const rel = await GetDatabase().setRelationship(this.account.id, id, { type: 'block', source: id });
			await this.update(rel);
			await accountManager.getAccountById(id)?.relationship.update(rel, this.account.username);
		}
		return true;
	}

	private async update(rel: DatabaseRelationship, name?: string): Promise<void> {
		const id = rel.accountIdA === this.account.id ? rel.accountIdB : rel.accountIdA;
		const existing = this.get(id);
		name ??= existing ? existing.name : (await GetDatabase().queryAccountNames([id]))[id];
		if (!name) {
			this.logger.warning(`Could not find name for account ${id}`);
			return;
		}
		this.setRelationship(id, name, rel.updated, rel.type, rel.source);
		const oldType = existing?.type;
		const newRel = this.get(id);
		const newType = newRel?.type;
		if (!newType
			|| (oldType === 'blocked' && newType === 'blockMutual')
			|| (oldType === 'blockMutual' && newType === 'blocked')
			|| (!oldType && newType === 'blockedBy')
		) {
			return;
		}
		if (oldType === 'blockMutual' && newType === 'blockedBy') {
			for (const connection of this.account.associatedConnections.values()) {
				connection.sendMessage('relationshipsUpdate', { id });
			}
			return;
		}
		for (const connection of this.account.associatedConnections.values()) {
			connection.sendMessage('relationshipsUpdate', newRel);
		}
	}

	private remove(id: AccountId): void {
		const existing = this.get(id);
		this.relationships.delete(id);
		if (existing?.type === 'blockedBy') {
			return;
		}
		for (const connection of this.account.associatedConnections.values()) {
			connection.sendMessage('relationshipsUpdate', { id });
		}
	}

	private loaded = false;
	private loading: Promise<void> | undefined;
	private load(): Promise<void> {
		if (this.loaded) {
			return Promise.resolve();
		}
		if (this.loading) {
			return this.loading;
		}
		this.loading = this._load();
		return this.loading;
	}

	private async _load(): Promise<void> {
		if (this.loaded) {
			return;
		}
		if (this.loading) {
			await this.loading;
			return;
		}
		const relationships = await GetDatabase().getRelationships(this.account.id);
		const ids = relationships.map((rel) => rel.accountIdA === this.account.id ? rel.accountIdB : rel.accountIdA);
		const names = await GetDatabase().queryAccountNames(_.uniq(ids));
		for (const rel of relationships) {
			const id = rel.accountIdA === this.account.id ? rel.accountIdB : rel.accountIdA;
			const name = names[id];
			if (!name) {
				this.logger.warning(`Could not find name for account ${id}`);
				continue;
			}
			this.setRelationship(id, name, rel.updated, rel.type, rel.source);
		}
		this.loaded = true;
	}

	private setRelationship(id: AccountId, name: string, time: number, type: DatabaseRelationship['type'], source?: AccountId): void {
		switch (type) {
			case 'friend':
				this.relationships.set(id, { id, name, time, type: 'friend' });
				break;
			case 'request':
				if (source === this.account.id) {
					this.relationships.set(id, { id, name, time, type: 'pending' });
				} else {
					this.relationships.set(id, { id, name, time, type: 'incoming' });
				}
				break;
			case 'block':
				if (source === this.account.id) {
					this.relationships.set(id, { id, name, time, type: 'blocked' });
				} else if (source === id) {
					this.relationships.set(id, { id, name, time, type: 'blockedBy' });
				} else {
					this.relationships.set(id, { id, name, time, type: 'blockMutual' });
				}
				break;
			default:
				AssertNever(type);
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

function RemoveBlockedBy(data: IAccountRelationship<'blockMutual' | 'blockedBy'>): data is IAccountRelationship<'blockMutual'> {
	return data.type !== 'blockedBy';
}

function CastMutualToSimple(data: IAccountRelationship<'blockMutual'>): IAccountRelationship {
	return {
		...data,
		type: data.type === 'blockMutual' ? 'blocked' : data.type,
	};
}
