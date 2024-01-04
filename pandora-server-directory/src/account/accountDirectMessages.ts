import { createHash } from 'crypto';
import type { IClientDirectoryArgument, IClientDirectoryPromiseResult, IDirectoryClientArgument, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import { Account, GetDirectMessageId } from './account';
import { accountManager } from './accountManager';
import { DatabaseDirectMessageInfo } from '../database/databaseStructure';

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
	private _infos?: IDirectoryDirectMessageInfo[];

	private get _publicKey(): string {
		return this._account.secure.getPublicKey() as string;
	}

	constructor(account: Account, data: DatabaseDirectMessageInfo[] | undefined) {
		this._account = account;
		this._dms = data ?? [];
	}

	public async getDirectMessageInfo(): Promise<IDirectoryDirectMessageInfo[]> {
		if (this._infos) {
			return this._infos;
		}
		const filtered = this._dms.filter((info) => !info.closed);
		const ids = await GetDatabase().queryAccountNames(filtered.map((info) => info.id));
		const dms: IDirectoryDirectMessageInfo[] = [];
		for (const info of filtered) {
			const displayName = ids[info.id];
			if (!displayName) {
				continue;
			}
			dms.push({
				...info,
				displayName,
			});
		}
		this._infos = dms;
		return dms;
	}

	public async action(account: Account | number, action: 'read' | 'close' | 'open' | 'new', { notifyClients = true, time }: { notifyClients?: boolean; time?: number; } = {}): Promise<void> {
		const id = typeof account === 'number' ? account : account.id;
		let dm = this._dms.find((info) => info.id === id);
		if (!dm) {
			if (typeof account === 'number' || !time) {
				return;
			}
			dm = {
				id,
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
		if (this._infos) {
			const index = this._infos.findIndex((info) => info.id === id);
			if (index !== -1) {
				if (dm.closed) {
					this._infos.splice(index, 1);
				} else {
					this._infos[index] = {
						...this._infos[index],
						...dm,
					};
				}
			} else if (!dm.closed) {
				const { [id]: displayName } = await GetDatabase().queryAccountNames([id]);
				if (displayName) {
					this._infos.push({
						...dm,
						displayName,
					});
				}
			}
		}
		if (notifyClients && action !== 'new' && action !== 'open') {
			this._account.associatedConnections.sendMessage('directMessageAction', { id, action });
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
		if (!await target.contacts.canReceiveDM(this._account)) {
			return { result: 'denied' };
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
		this._account.associatedConnections.sendMessage('directMessageGet', message);
	}

	private directMessageSent(message: IDirectoryClientArgument['directMessageSent']): void {
		this._account.associatedConnections.sendMessage('directMessageSent', message);
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
			displayName: account.displayName,
			labelColor: account.data.settings.labelColor,
			publicKeyData: account.directMessages._publicKey,
		};
	}
}

function KeyHash(keyA: string, keyB: string): string {
	const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
	return createHash('sha256').update(text, 'utf-8').digest('base64');
}
