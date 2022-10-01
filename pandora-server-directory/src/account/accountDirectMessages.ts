import type { IClientDirectoryArgument, IClientDirectoryPromiseResult, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import type { Account } from './account';
import { accountManager } from './accountManager';

const MESSAGE_LOAD_COUNT = 50;

let lastMessageTime = 0;
function GetNextMessageTime(): number {
	let time = Date.now();
	if (time <= lastMessageTime) {
		time = lastMessageTime + 1;
	}
	lastMessageTime = time;
	return time;
}

export class AccountDirectMessages {
	private readonly _account: Account;
	private _dms: DatabaseDirectMessageInfo[];

	get dms(): IDirectoryDirectMessageInfo[] {
		return this._dms
			.filter((dm) => !dm.closed);
	}

	private get _publicKey(): string {
		return this._account.secure.getPublicKey() as string;
	}

	constructor(account: Account, data: DatabaseAccount) {
		this._account = account;
		this._dms = data.directMessages ?? [];
	}

	async action(id: number, action: 'read' | 'close' | 'open' | 'new', notifyClients: boolean = true): Promise<void> {
		const dm = this._dms.find((info) => info.id === id);
		if (!dm) {
			return;
		}
		switch (action) {
			case 'read':
				if (dm.hasUnread) {
					delete dm.hasUnread;
				} else {
					return;
				}
				break;
			case 'close':
				if (!dm.closed) {
					dm.closed = true;
					delete dm.hasUnread;
				} else {
					return;
				}
				break;
			case 'open':
				if (dm.closed) {
					delete dm.closed;
				} else {
					return;
				}
				break;
			case 'new':
				if (!dm.hasUnread) {
					dm.hasUnread = true;
					delete dm.closed;
				} else {
					return;
				}
				break;
		}
		if (notifyClients && action !== 'new' && action !== 'open') {
			for (const connection of this._account.associatedConnections) {
				connection.sendMessage('directMessage', { id, action });
			}
		}
		await GetDatabase().setDirectMessageInfo(this._account.id, this._dms);
	}

	async sendMessage({ id, content, editing }: IClientDirectoryArgument['sendDirectMessage']): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target || !target.directMessages._publicKey) {
			return { result: 'notFound' };
		}
		const time = GetNextMessageTime();
		const [a, b] = this._account.id < target.id ? [this._account, target] : [target, this._account];
		const accounts: DirectMessageAccounts = `${a.id}-${b.id}`;
		const message: IDirectoryDirectMessage = {
			content,
			time: editing ?? time,
			source: this._account.id,
			edited: editing && time,
		};
		if (!await GetDatabase().setDirectMessage(accounts, message)) {
			return { result: 'messageNotFound' };
		}
		await target.directMessages.handleMessage({ ...message, target: target.id, account: this._getAccountInfo() });
		await this.handleMessage({ ...message, target: target.id });
		return { result: 'ok' };
	}

	async handleMessage(message: IDirectoryDirectMessage & { account?: IDirectoryDirectMessageAccount; target: number; }): Promise<void> {
		const self = message.source === this._account.id;
		if (self) {
			await this.action(message.target, 'open', false);
		} else if (message.edited === undefined) {
			await this.action(message.source, 'new', false);
		}
		for (const connection of this._account.associatedConnections) {
			connection.sendMessage('directMessage', { message });
		}
	}

	async getMessages(id: number, until?: number): IClientDirectoryPromiseResult['getDirectMessages'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target || !target.directMessages._publicKey) {
			return { result: 'notFound' };
		}
		const [a, b] = this._account.id < target.id ? [this._account, target] : [target, this._account];
		const messages = await GetDatabase().getDirectMessages(`${a.id}-${b.id}`, MESSAGE_LOAD_COUNT, until);
		return {
			result: 'ok',
			account: target.directMessages._getAccountInfo(),
			messages,
		};
	}

	private _getAccountInfo(): IDirectoryDirectMessageAccount {
		const account = this._account;
		return {
			id: account.id,
			name: account.username,
			labelColor: account.data.settings.labelColor,
			publicKeyData: account.directMessages._publicKey,
		};
	}
}
