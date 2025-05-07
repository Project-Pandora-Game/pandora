import { AccountId, AsyncSynchronized, IAccountContact, IAccountFriendStatus, IClientDirectory, IConnectionBase, IDirectoryClientArgument, TypedEventEmitter } from 'pandora-common';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { Observable, useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import './accountContacts.scss';

const ACCOUNT_CONTACTS = new Observable<readonly IAccountContact[]>([]);
const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

export function useAccountContacts(type: IAccountContact['type'] | null) {
	const rel = useObservable(ACCOUNT_CONTACTS);
	return useMemo(() => (type === null ? rel : rel.filter((r) => r.type === type)), [rel, type]);
}

export function useAccountContact(id: AccountId): IAccountContact | undefined {
	const rel = useObservable(ACCOUNT_CONTACTS);
	return useMemo(() => rel.find((r) => r.id === id), [rel, id]);
}

export function useFriendStatus() {
	return useObservable(FRIEND_STATUS);
}

export const AccountContactContext = new class AccountContactContext extends TypedEventEmitter<{
	incoming: IAccountContact & { type: 'incoming'; };
}> {
	private _queue: (() => void)[] = [];
	private _useQueue = true;

	@AsyncSynchronized()
	public async initStatus(connection: IConnectionBase<IClientDirectory>): Promise<void> {
		if (!this._useQueue) {
			return;
		}
		const { friends, contacts } = await connection.awaitResponse('getAccountContacts', {});
		ACCOUNT_CONTACTS.value = contacts;
		FRIEND_STATUS.value = friends;
		this._dequeue();
	}

	public handleFriendStatus(data: IDirectoryClientArgument['friendStatus']) {
		if (this._useQueue) {
			this._queue.push(() => this.handleFriendStatus(data));
			return;
		}
		const filtered = FRIEND_STATUS.value.filter((status) => status.id !== data.id);
		if (data.online !== 'delete') {
			filtered.push(data);
		}
		FRIEND_STATUS.value = filtered;
	}

	public handleAccountContactUpdate({ contact, friendStatus }: IDirectoryClientArgument['accountContactUpdate']) {
		if (this._useQueue) {
			this._queue.push(() => this.handleAccountContactUpdate({ contact, friendStatus }));
			return;
		}
		// Update relationship side
		{
			const filtered = ACCOUNT_CONTACTS.value.filter((current) => current.id !== contact.id);
			if (contact.type !== 'none') {
				filtered.push(contact);
				if (filtered.length > ACCOUNT_CONTACTS.value.length && contact.type === 'incoming') {
					this.emit('incoming', { ...contact, type: 'incoming' });
				}
			}
			ACCOUNT_CONTACTS.value = filtered;
		}
		// Update friend side
		{
			const filtered = FRIEND_STATUS.value.filter((status) => status.id !== friendStatus.id);
			if (friendStatus.online !== 'delete') {
				filtered.push(friendStatus);
			}
			FRIEND_STATUS.value = filtered;
		}
	}

	public handleLogout() {
		this._useQueue = true;
		FRIEND_STATUS.value = [];
		ACCOUNT_CONTACTS.value = [];
	}

	private _dequeue() {
		this._useQueue = false;
		this._queue.forEach((fn) => fn());
		this._queue = [];
	}
};

type AccountContactChangeHandleResult = 'ok' | 'accountNotFound' | 'requestNotFound' | 'blocked' | 'requestAlreadyExists';
export function AccountContactChangeHandleResult(result?: null | AccountContactChangeHandleResult | { result: AccountContactChangeHandleResult; }) {
	if (result == null) {
		return;
	}
	if (typeof result === 'object' && 'result' in result) {
		result = result.result;
	}
	switch (result) {
		case 'ok':
			return;
		case 'accountNotFound':
			toast('Account not found', TOAST_OPTIONS_ERROR);
			return;
		case 'requestNotFound':
			toast('Request not found', TOAST_OPTIONS_ERROR);
			return;
		case 'blocked':
			toast('Account is blocked', TOAST_OPTIONS_ERROR);
			return;
		case 'requestAlreadyExists':
			toast('Request already exists', TOAST_OPTIONS_ERROR);
			return;
		default:
			toast('Unknown error', TOAST_OPTIONS_ERROR);
			return;
	}
}
