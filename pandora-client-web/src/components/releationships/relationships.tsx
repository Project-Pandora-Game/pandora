import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountId, IAccountFriendStatus, IAccountRelationship } from 'pandora-common';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { DirectMessages } from '../directMessages/directMessages';
import './relationships.scss';
import { Button } from '../common/button/button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { NotificationSource, useNotificationSuppressed } from '../gameContext/notificationContextProvider';
import { useAsyncEvent } from '../../common/useEvent';
import _ from 'lodash';
import { Row } from '../common/container/container';
import { RelationshipChangeHandleResult, useFriendStatus, useRelationships } from './relationshipsContext';
import { useConfirmDialog } from '../dialog/dialog';

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
	const confirm = useConfirmDialog();
	const actions = useMemo(() => {
		switch (type) {
			case 'blocked':
				return (
					<Button className='slim' onClick={
						() => void confirm(`Unblock ${name}?`).then((result) => {
							if (result)
								directory.sendMessage('blockList', { id, action: 'remove' });
						}).catch(() => { /** ignore */ })
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
	}, [type, name, id, directory, confirm]);
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
	}, RelationshipChangeHandleResult);
	return (
		<Button className='slim' onClick={ cancel } disabled={ cancelInProgress }>Cancel</Button>
	);
}

function IncomingRequestActions({ id }: { id: AccountId; }) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const [accept, acceptInProgress] = useAsyncEvent(async () => {
		if (await confirm(`Accept the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'accept' });
		}
		return undefined;
	}, RelationshipChangeHandleResult);
	const [decline, declineInProgress] = useAsyncEvent(async () => {
		if (await confirm(`Decline the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'decline' });
		}
		return undefined;
	}, RelationshipChangeHandleResult);
	return (
		<>
			<Button className='slim' onClick={ accept } disabled={ acceptInProgress }>Accept</Button>
			<Button className='slim' onClick={ decline } disabled={ declineInProgress }>Decline</Button>
		</>
	);
}

function ShowFriends() {
	const friends = useRelationships('friend');
	const status = useFriendStatus();
	const friendsWithStatus = useMemo(() => {
		return friends.map((friend) => {
			const stat = status.find((s) => s.id === friend.id);
			return {
				id: friend.id,
				name: friend.name,
				time: friend.time,
				online: stat?.online === true,
				characters: stat?.characters,
			};
		});
	}, [friends, status]);

	return (
		<table>
			<colgroup>
				<col style={ { width: '1%' } } />
				<col />
				<col />
				<col />
				<col style={ { width: '1%' } } />
				<col style={ { width: '1%' } } />
			</colgroup>
			<thead>
				<tr>
					<th>ID</th>
					<th>Name</th>
					<th>Status</th>
					<th>Online Characters</th>
					<th>Since</th>
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
	online,
	characters,
}: {
	id: AccountId;
	name: string;
	time: number;
	online: boolean;
	characters?: IAccountFriendStatus['characters'];
}) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();

	const [unfriend, processing] = useAsyncEvent(async () => {
		if (await confirm(`Are you sure you want to remove ${name} from your contacts list?`)) {
			return await directory.awaitResponse('unfriend', { id });
		}
		return undefined;
	}, RelationshipChangeHandleResult);

	return (
		<tr className={ online ? 'friend online' : 'friend offline' }>
			<td className='selectable'>{ id }</td>
			<td className='selectable'>{ name }</td>
			<td className='status'>
				<Row className='fill' alignX='center' alignY='center'>
					<span className='indicator'>
						{ online ? '\u25CF' : '\u25CB' }
					</span>
					{ online ? 'Online' : 'Offline' }
				</Row>
			</td>
			<td>{ characters?.map((c) => c.name).join(', ') }</td>
			<td>{ new Date(time).toLocaleDateString() }</td>
			<td>
				<Button className='slim' onClick={ unfriend } disabled={ processing }>
					Remove
				</Button>
			</td>
		</tr>
	);
}
