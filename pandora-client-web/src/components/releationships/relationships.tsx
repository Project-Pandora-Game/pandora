import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountId, AsyncSynchronized, IAccountFriendStatus, IAccountRelationship, IClientDirectory, IConnectionBase, IDirectoryClientArgument, TypedEventEmitter } from 'pandora-common';
import { Observable, useObservable } from '../../observable';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { DirectMessages } from '../directMessages/directMessages';
import './relationships.scss';
import { Button } from '../common/button/button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { NotificationSource, useNotificationSuppressed } from '../gameContext/notificationContextProvider';
import { useAsyncEvent } from '../../common/useEvent';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import _ from 'lodash';

const RELATIONSHIPS = new Observable<readonly IAccountRelationship[]>([]);
const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

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

export function Relationships() {
	const navigate = useNavigate();

	return (
		<div className='relationships'>
			<TabContainer>
				<Tab name={ <RelationshipHeader type='friend' /> }>
					<ShowFriends />
				</Tab>
				<Tab name='DMs'>
					<DirectMessages />
				</Tab>
				<Tab name='Blocked'>
					<ShowRelationships type='blocked' />
				</Tab>
				<Tab name={ <RelationshipHeader type='pending' /> }>
					<ShowRelationships type='pending' />
				</Tab>
				<Tab name={ <RelationshipHeader type='incoming' /> }>
					<ShowRelationships type='incoming' />
					<ClearIncoming />
				</Tab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate(-1) } />
			</TabContainer>
		</div>
	);
}

export function useRelationships(type: IAccountRelationship['type']) {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.filter((r) => r.type === type), [rel, type]);
}

export function useRelationship(id: AccountId): IAccountRelationship | undefined {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.find((r) => r.id === id), [rel, id]);
}

function RelationshipHeader({ type }: { type: IAccountRelationship['type']; }) {
	const count = useRelationships(type).length;

	return (
		<>
			{ _.capitalize(type) } ({ count })
		</>
	);
}

function ClearIncoming() {
	useNotificationSuppressed(NotificationSource.INCOMING_FRIEND_REQUEST);
	return null;
}

function ShowRelationships({ type }: { type: IAccountRelationship['type']; }) {
	const rel = useRelationships(type);
	return (
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Name</th>
					<th>Created</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{ rel.map((r) => (
					<RelationshipsRow key={ r.id } { ...r } />
				)) }
			</tbody>
		</table>
	);
}

function RelationshipsRow({
	id,
	name,
	time,
	type,
}: {
	id: AccountId;
	name: string;
	time: number;
	type: IAccountRelationship['type'];
}) {
	const directory = useDirectoryConnector();
	const actions = useMemo(() => {
		switch (type) {
			case 'blocked':
				return (
					<Button className='slim' onClick={
						() => confirm(`Unblock ${name}?`) && directory.sendMessage('blockList', { id, action: 'remove' })
					}>
						Unblock
					</Button>
				);
			case 'pending':
				return <PendingRequestActions id={ id } />;
			case 'incoming':
				return <IncomingRequestActions id={ id } />;
			default:
				return null;
		}
	}, [type, name, id, directory]);
	return (
		<tr>
			<td>{ id }</td>
			<td>{ name }</td>
			<td>{ new Date(time).toLocaleString() }</td>
			<td>{ actions }</td>
		</tr>
	);
}

function PendingRequestActions({ id }: { id: AccountId; }) {
	const directory = useDirectoryConnector();
	const [cancel, cancelInProgress] = useAsyncEvent(async () => {
		return await directory.awaitResponse('friendRequest', { id, action: 'cancel' });
	}, (r) => HandleResult(r?.result));
	return (
		<Button className='slim' onClick={ cancel } disabled={ cancelInProgress }>Cancel</Button>
	);
}

function IncomingRequestActions({ id }: { id: AccountId; }) {
	const directory = useDirectoryConnector();
	const [accept, acceptInProgress] = useAsyncEvent(async () => {
		if (confirm(`Accept the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'accept' });
		}
		return undefined;
	}, (r) => HandleResult(r?.result));
	const [decline, declineInProgress] = useAsyncEvent(async () => {
		if (confirm(`Decline the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'decline' });
		}
		return undefined;
	}, (r) => HandleResult(r?.result));
	return (
		<>
			<Button className='slim' onClick={ accept } disabled={ acceptInProgress }>Accept</Button>
			<Button className='slim' onClick={ decline } disabled={ declineInProgress }>Decline</Button>
		</>
	);
}

function ShowFriends() {
	const friends = useRelationships('friend');
	const status = useObservable(FRIEND_STATUS);
	const friendsWithStatus = useMemo(() => {
		return friends.map((friend) => {
			const stat = status.find((s) => s.id === friend.id);
			return {
				id: friend.id,
				name: friend.name,
				time: friend.time,
				status: stat?.online ? 'online' : 'offline',
				characters: stat?.characters,
			};
		});
	}, [friends, status]);

	return (
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Name</th>
					<th>Created</th>
					<th>Status</th>
					<th>Online Characters</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{ friendsWithStatus.map((friend) => (
					<FriendRow key={ friend.id } { ...friend } />
				)) }
			</tbody>
		</table>
	);
}

function FriendRow({
	id,
	name,
	time,
	status,
	characters,
}: {
	id: AccountId;
	name: string;
	time: number;
	status: string;
	characters?: IAccountFriendStatus['characters'];
}) {
	const directory = useDirectoryConnector();

	const [unfriend, processing] = useAsyncEvent(async () => {
		if (confirm(`Are you sure you want to remove ${name} from your contacts list?`)) {
			return await directory.awaitResponse('unfriend', { id });
		}
		return undefined;
	}, (r) => HandleResult(r?.result));

	return (
		<tr>
			<td>{ id }</td>
			<td>{ name }</td>
			<td>{ new Date(time).toLocaleString() }</td>
			<td>{ status }</td>
			<td>{ characters?.map((c) => c.name).join(', ') }</td>
			<td>
				<Button className='slim' onClick={ unfriend } disabled={ processing }>
					Remove
				</Button>
			</td>
		</tr>
	);
}

export function HandleResult(result: 'ok' | 'accountNotFound' | 'requestNotFound' | 'blocked' | 'requestAlreadyExists' | undefined) {
	switch (result) {
		case undefined:
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
