import { AccountId, IAccountContact, IAccountFriendStatus, IDirectoryClientArgument, TypedEventEmitter } from 'pandora-common';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { Observable, useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import './accountContacts.scss';

const ACCOUNT_CONTACTS = new Observable<readonly IAccountContact[]>([]);
const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

export function useAccountContacts(type: IAccountContact['type'] | null): readonly IAccountContact[] {
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

export function GetCurrentAccountContacts(): readonly IAccountContact[] {
	return ACCOUNT_CONTACTS.value;
}

export const AccountContactContext = new class AccountContactContext extends TypedEventEmitter<{
	incoming: IAccountContact & { type: 'incoming'; };
}> {
	public handleAccountContactInit({ friends, contacts }: IDirectoryClientArgument['accountContactInit']): void {
		ACCOUNT_CONTACTS.value = contacts;
		FRIEND_STATUS.value = friends;
	}

	public handleAccountContactUpdate({ contact, friendStatus }: IDirectoryClientArgument['accountContactUpdate']): void {
		// Update relationship side
		if (contact != null) {
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
			if (friendStatus.status !== null) {
				filtered.push(friendStatus);
			}
			FRIEND_STATUS.value = filtered;
		}
	}

	public handleLogout() {
		FRIEND_STATUS.value = [];
		ACCOUNT_CONTACTS.value = [];
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
