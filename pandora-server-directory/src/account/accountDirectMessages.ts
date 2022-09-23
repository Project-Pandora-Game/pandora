import type { IClientDirectoryArgument, IClientDirectoryPromiseResult } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import type { Account } from './account';
import { accountManager } from './accountManager';

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
	private _unreadMessages: number[];

	get unreadMessages(): readonly number[] {
		return this._unreadMessages;
	}

	private get _publicKey(): string {
		return this._account.secure.getPublicKey() as string;
	}

	constructor(account: Account) {
		this._account = account;
		this._unreadMessages = account.data.unreadMessages ?? [];
	}

	async ackMessage(id: number | 'all'): Promise<void> {
		if (this._unreadMessages.length === 0) {
			return;
		}
		if (id === 'all') {
			this._unreadMessages = [];
		} else {
			const index = this._unreadMessages.indexOf(id);
			if (index < 0) {
				return;
			}
			this._unreadMessages.splice(index, 1);
		}
		await this._updateUnreadMessages();
	}

	async sendMessage({ id, message, editing }: IClientDirectoryArgument['sendDirectMessage']): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target) {
			return { result: 'notFound' };
		}
		return await target.directMessages.handleMessage(this._account, message, editing);
	}

	async handleMessage(source: Account, message: string, editing?: number): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!this._publicKey) {
			return { result: 'notFound' };
		}
		const time = GetNextMessageTime();
		const [a, b] = this._account.id < source.id ? [this._account, source] : [source, this._account];
		if (!await GetDatabase().setDirectMessage(`${a.id}-${b.id}`, `${a.directMessages._publicKey}-${b.directMessages._publicKey}`, { time, message, source: source.id }, editing)) {
			return { result: 'messageNotFound' };
		}

		if (!editing) {
			this._unreadMessages.push(time);
			await this._updateUnreadMessages();
		} else if (!this._unreadMessages.includes(editing)) {
			this._unreadMessages.push(editing);
			await this._updateUnreadMessages();
		}

		if (this._account.associatedConnections.size !== 0) {
			const data = {
				account: this._getAccountInfo(source),
				message,
				time: editing ?? time,
				edited: editing && time,
			};
			for (const connection of this._account.associatedConnections) {
				connection.sendMessage('newDirectMessage', data);
			}
		}
		return { result: 'ok', time };
	}

	async getMessages(id: number): IClientDirectoryPromiseResult['getDirectMessages'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target || !target.directMessages._publicKey) {
			return { result: 'notFound' };
		}
		const [a, b] = this._account.id < target.id ? [this._account, target] : [target, this._account];
		const { messages } = await GetDatabase().getDirectMessages(`${a.id}-${b.id}`, `${a.directMessages._publicKey}-${b.directMessages._publicKey}`);
		return {
			result: 'ok',
			account: this._getAccountInfo(target),
			messages,
		};
	}

	private async _updateUnreadMessages(): Promise<void> {
		await GetDatabase().setUnreadMessages(this._account.id, this._unreadMessages);
	}

	private _getAccountInfo(account: Account): { id: number; name: string; labelColor: string; publicKeyData: string; } {
		return {
			id: account.id,
			name: account.username,
			labelColor: account.data.settings.labelColor,
			publicKeyData: account.directMessages._publicKey,
		};
	}
}
