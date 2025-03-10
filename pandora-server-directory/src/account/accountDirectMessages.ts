import { createHash } from 'crypto';
import {
	IClientDirectoryArgument,
	IClientDirectoryPromiseResult,
	IDirectoryDirectMessageAccount,
	IDirectoryDirectMessageInfo,
	LIMIT_DIRECT_MESSAGE_STORE_COUNT,
	type AccountId,
	type IDirectoryDirectMessage,
} from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider.ts';
import type { DatabaseDirectMessage, DatabaseDirectMessageInfo } from '../database/databaseStructure.ts';
import { Account, GetDirectMessageId } from './account.ts';
import { accountManager } from './accountManager.ts';

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

	private get _publicKey(): string {
		return this._account.secure.getPublicKey() as string;
	}

	constructor(account: Account, data: DatabaseDirectMessageInfo[] | undefined) {
		this._account = account;
		this._dms = data ?? [];
	}

	public async getDirectMessageInfo(): Promise<IDirectoryDirectMessageInfo[]> {
		const filtered = this._dms.filter((info) => !info.closed);
		const ids = await GetDatabase().queryAccountDisplayNames(filtered.map((info) => info.id));
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
		if (notifyClients && action !== 'new' && action !== 'open') {
			this._account.associatedConnections.sendMessage('directMessageAction', { id, action });
		}
		await GetDatabase().setDirectMessageInfo(this._account.id, this._dms);
	}

	public async sendMessage({ id, keyHash: messageKeyHash, content, editing }: IClientDirectoryArgument['sendDirectMessage']): IClientDirectoryPromiseResult['sendDirectMessage'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target) {
			return { result: 'notFound' };
		}
		if (!target.directMessages._publicKey) {
			return { result: 'badKey' };
		}
		const keyHash = KeyHash(this._publicKey, target.directMessages._publicKey);
		if (messageKeyHash !== keyHash) {
			return { result: 'badKey' };
		}
		if (!await target.contacts.canReceiveDM(this._account)) {
			return { result: 'denied' };
		}
		const time = GetNextMessageTime();
		const accounts = GetDirectMessageId(this._account, target);
		const message: DatabaseDirectMessage = {
			content,
			time: editing ?? time,
			source: this._account.id,
			edited: editing ? time : undefined,
		};
		if (!await GetDatabase().setDirectMessage(accounts, keyHash, message, LIMIT_DIRECT_MESSAGE_STORE_COUNT)) {
			return { result: 'messageNotFound' };
		}
		if (editing === undefined) {
			await this.action(target, 'open', { notifyClients: false, time });
			await target.directMessages.action(this._account, 'new', { notifyClients: false, time });
		}
		target.directMessages.directMessageNew({
			...message,
			keyHash,
		}, this._account.id);
		this.directMessageNew({
			...message,
			keyHash,
		}, target.id);
		return { result: 'ok' };
	}

	private directMessageNew(message: IDirectoryDirectMessage, otherAccount: AccountId): void {
		this._account.associatedConnections.sendMessage('directMessageNew', {
			target: otherAccount,
			message,
		});
	}

	public async getMessages(id: number): IClientDirectoryPromiseResult['getDirectMessages'] {
		if (!this._publicKey) {
			return { result: 'denied' };
		}
		const target = await accountManager.loadAccountById(id);
		if (!target) {
			return { result: 'notFound' };
		}
		if (!target.directMessages._publicKey) {
			return { result: 'noKeyAvailable' };
		}
		const dms = await GetDatabase().getDirectMessages(GetDirectMessageId(this._account, target));
		if (dms == null || dms.messages.length === 0) {
			return {
				result: 'ok',
				account: target.directMessages._getAccountInfo(),
				messages: [],
			};
		}
		return {
			result: 'ok',
			account: target.directMessages._getAccountInfo(),
			messages: dms.messages.map((message) => ({
				...message,
				keyHash: dms.keyHash,
			})),
		};
	}

	private _getAccountInfo(): IDirectoryDirectMessageAccount {
		const account = this._account;
		const accountSettings = account.getEffectiveSettings();

		return {
			id: account.id,
			displayName: account.displayName,
			labelColor: accountSettings.labelColor,
			publicKeyData: account.directMessages._publicKey,
		};
	}
}

function KeyHash(keyA: string, keyB: string): string {
	const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
	return createHash('sha256').update(text, 'utf-8').digest('base64');
}
