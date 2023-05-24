import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountId, IAccountFriendStatus, IAccountRelationship, IClientDirectoryNormalResult, IClientDirectoryPromiseResult, IDirectoryClientArgument } from 'pandora-common';
import { Observable, useObservable } from '../../observable';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { DirectMessages } from '../directMessages/directMessages';
import './relationships.scss';
import { Button } from '../common/button/button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useAsyncEvent } from '../../common/useEvent';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';

const RELATIONSHIPS = new Observable<readonly IAccountRelationship[]>([]);
const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

export const RelationshipContext = new class RelationshipContext {
	private _queue: (() => void)[] = [];
	private _useQueue = true;

	public async initStatus(load: () => IClientDirectoryPromiseResult['getRelationships']) {
		if (!this._useQueue) {
			return;
		}
		const { friends, relationships } = await load();
		this.handleStatus({ friends, relationships });
	}

	public handleStatus({ friends, relationships }: IClientDirectoryNormalResult['getRelationships']) {
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
		if ('online' in data) {
			filtered.push(data);
		}
		FRIEND_STATUS.value = filtered;
	}

	public handleRelationshipsUpdate(data: IDirectoryClientArgument['relationshipsUpdate']) {
		if (this._useQueue) {
			this._queue.push(() => this.handleRelationshipsUpdate(data));
			return;
		}
		const filtered = RELATIONSHIPS.value.filter((relationship) => relationship.id !== data.id);
		if ('name' in data) {
			filtered.push(data);
		}
		RELATIONSHIPS.value = filtered;
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
				<Tab name='Friends'>
					<ShowFriends />
				</Tab>
				<Tab name='DMs'>
					<DirectMessages />
				</Tab>
				<Tab name='Blocked'>
					<ShowRelationships type='blocked' />
				</Tab>
				<Tab name='Pending'>
					<ShowRelationships type='pending' />
				</Tab>
				<Tab name='Incoming'>
					<ShowRelationships type='incoming' />
				</Tab>
				<Tab name='◄ Back' className='slim' onClick={ () => navigate(-1) } />
			</TabContainer>
		</div>
	);
}

function useRelationships(type: IAccountRelationship['type']) {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.filter((r) => r.type === type), [rel, type]);
}

export function useRelationship(id: AccountId): IAccountRelationship | undefined {
	const rel = useObservable(RELATIONSHIPS);
	return useMemo(() => rel.find((r) => r.id === id), [rel, id]);
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
		if (confirm(`Accept friend request from ${id}?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'accept' });
		}
		return undefined;
	}, (r) => HandleResult(r?.result));
	const [decline, declineInProgress] = useAsyncEvent(async () => {
		if (confirm(`Decline friend request from ${id}?`)) {
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
		if (confirm(`Are you sure you want to remove ${name} from your friends list?`)) {
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
			<td>{ characters?.length !== 0 ? 'yes' : 'no' }</td>
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
