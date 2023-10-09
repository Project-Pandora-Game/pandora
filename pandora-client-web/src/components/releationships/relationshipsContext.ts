import { useMemo } from 'react';
import { AccountId, AsyncSynchronized, IAccountFriendStatus, IAccountRelationship, IClientDirectory, IConnectionBase, IDirectoryClientArgument, TypedEventEmitter } from 'pandora-common';
import { Observable, useObservable } from '../../observable';
import './relationships.scss';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';

const RELATIONSHIPS = new Observable<readonly IAccountRelationship[]>([]);
const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

export function useRelationships(type: IAccountRelationship['type']) {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.filter((r) => r.type === type), [rel, type]);
}

export function useRelationship(id: AccountId): IAccountRelationship | undefined {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.find((r) => r.id === id), [rel, id]);
}

export function useFriendStatus() {
	return useObservable(FRIEND_STATUS);
}

export const RelationshipContext = new class RelationshipContext extends TypedEventEmitter<{
	incoming: IAccountRelationship & { type: 'incoming'; };
}> {
	private _queue: (() => void)[] = [];
	private _useQueue = true;

	@AsyncSynchronized()
	public async initStatus(connection: IConnectionBase<IClientDirectory>): Promise<void> {
		if (!this._useQueue) {
			return;
		}
		const { friends, relationships } = await connection.awaitResponse('getRelationships', {});
		RELATIONSHIPS.value = relationships;
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

	public handleRelationshipsUpdate({ relationship, friendStatus }: IDirectoryClientArgument['relationshipsUpdate']) {
		if (this._useQueue) {
			this._queue.push(() => this.handleRelationshipsUpdate({ relationship, friendStatus }));
			return;
		}
		// Update relationship side
		{
			const filtered = RELATIONSHIPS.value.filter((currentRelationship) => currentRelationship.id !== relationship.id);
			if (relationship.type !== 'none') {
				filtered.push(relationship);
				if (filtered.length > RELATIONSHIPS.value.length && relationship.type === 'incoming') {
					this.emit('incoming', { ...relationship, type: 'incoming' });
				}
			}
			RELATIONSHIPS.value = filtered;
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
		RELATIONSHIPS.value = [];
	}

	private _dequeue() {
		this._useQueue = false;
		this._queue.forEach((fn) => fn());
		this._queue = [];
	}
};

type RelationshipChangeHandleResult = 'ok' | 'accountNotFound' | 'requestNotFound' | 'blocked' | 'requestAlreadyExists';
export function RelationshipChangeHandleResult(result?: null | RelationshipChangeHandleResult | { result: RelationshipChangeHandleResult; }) {
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
