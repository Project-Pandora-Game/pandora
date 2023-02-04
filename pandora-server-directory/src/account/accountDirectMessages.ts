import { createHash } from 'crypto';
import type { IClientDirectoryArgument, IClientDirectoryPromiseResult, IDirectoryClientArgument, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account, GetDirectMessageId } from './account';
import { accountManager } from './accountManager';

const MESSAGE_LOAD_COUNT = 50;

let lastMessageTime = 0;
/** TODO: handle host machine time jumping backwards */
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

	public get dms(): IDirectoryDirectMessageInfo[] {
		return this._dms
			.filter((dm) => !dm.closed);
	}

	private get _publicKey(): string {
		return this._account.secure.getPublicKey() as string;
	}

	constructor(account: Account, data: DatabaseDirectMessageInfo[] | undefined) {
		this._account = account;
		this._dms = data ?? [];
	}

	public async action(account: Account | number, action: 'read' | 'close' | 'open' | 'new', { notifyClients = true, time }: { notifyClients?: boolean; time?: number } = {}): Promise<void> {
		const id = typeof account === 'number' ? account : account.id;
		let dm = this._dms.find((info) => info.id === id);
		if (!dm) {
			if (typeof account === 'number' || !time) {
				return;
			}
			dm = {
				id,
				account: account.username,
				time,
			};
			this._dms.push(dm);
		}
		if (time !== undefined) {
			dm.time = time;
		}
		switch (action) {
			case 'read':
				delete dm.hasUnread;
				break;
			case 'close':
				dm.closed = true;
				delete dm.hasUnread;
				break;
			case 'open':
				delete dm.closed;
				break;
			case 'new':
				dm.hasUnread = true;
				delete dm.closed;
				break;
		}
		if (notifyClients && action !== 'new' && action !== 'open') {
			for (const connection of this._account.associatedConnections) {
				connection.sendMessage('directMessageAction', { id, action });
			}
		}
		await GetDatabase().setDirectMessageInfo(this._account.id, this._dms);
	}

	public async sendMessage({ id, content, editing }: IClientDirectoryArgument['sendDirectMessage']): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target || !target.directMessages._publicKey) {
			return { result: 'notFound' };
		}
		const time = GetNextMessageTime();
		const accounts = GetDirectMessageId(this._account, target);
		const message: IDirectoryDirectMessage = {
			content,
			keyHash: KeyHash(this._publicKey, target.directMessages._publicKey),
			time: editing ?? time,
			source: this._account.id,
			edited: editing ? time : undefined,
		};
		if (!await GetDatabase().setDirectMessage(accounts, message)) {
			return { result: 'messageNotFound' };
		}
		if (editing === undefined) {
			await this.action(target, 'open', { notifyClients: false, time });
			await target.directMessages.action(this._account, 'new', { notifyClients: false, time });
		}
		target.directMessages.directMessageGet({ ...message, account: this._getAccountInfo() });
		this.directMessageSent({ ...message, target: target.id });
		return { result: 'ok' };
	}

	private directMessageGet(message: IDirectoryClientArgument['directMessageGet']): void {
		for (const connection of this._account.associatedConnections) {
			connection.sendMessage('directMessageGet', message);
		}
	}

	private directMessageSent(message: IDirectoryClientArgument['directMessageSent']): void {
		for (const connection of this._account.associatedConnections) {
			connection.sendMessage('directMessageSent', message);
		}
	}

	public async getMessages(id: number, until?: number): IClientDirectoryPromiseResult['getDirectMessages'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target || !target.directMessages._publicKey) {
			return { result: 'notFound' };
		}
		const messages = await GetDatabase().getDirectMessages(GetDirectMessageId(this._account, target), MESSAGE_LOAD_COUNT, until);
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

function KeyHash(keyA: string, keyB: string): string {
	const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
	return createHash('sha256').update(text, 'utf-8').digest('base64');
}
