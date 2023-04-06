import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountId, IAccountFriendStatus, IAccountRelationship } from 'pandora-common';
import { Observable, useObservable } from '../../observable';
import { Column, Row } from '../common/container/container';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { DirectMessages } from '../directMessages/directMessages';
import './relationships.scss';
import { Button } from '../common/button/button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';

export const RELATIONSHIPS = new Observable<readonly IAccountRelationship[]>([]);
export const FRIEND_STATUS = new Observable<readonly IAccountFriendStatus[]>([]);

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

function ShowRelationships({ type }: { type: IAccountRelationship['type']; }) {
	const rel = useRelationships(type);
	return (
		<Column>
			<Row>
				<span>ID</span>
				<span>Name</span>
				<span>Created</span>
				<span>Actions</span>
			</Row>
			{ rel.map((r) => (
				<RelationshipsRow key={ r.id } { ...r } />
			)) }
		</Column>
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
						() => directory.sendMessage('blockList', { id, action: 'remove' })
					}>Unblock
					</Button>
				);
			case 'pending':
				return (
					<Button className='slim' onClick={
						() => void directory.awaitResponse('friendRequest', { id, action: 'cancel' }).catch(() => { /* ignore */ })
					}>Cancel
					</Button>
				);
			case 'incoming':
				return (
					<>
						<Button className='slim' onClick={
							() => void directory.awaitResponse('friendRequest', { id, action: 'accept' }).catch(() => { /* ignore */ })
						}>Accept
						</Button>
						<Button className='slim' onClick={
							() => void directory.awaitResponse('friendRequest', { id, action: 'decline' }).catch(() => { /* ignore */ })
						}>Decline
						</Button>
					</>
				);
			default:
				return null;
		}
	}, [type, name, id, directory]);
	return (
		<Row>
			<span>{ id }</span>
			<span>{ name }</span>
			<span>{ new Date(time).toLocaleString() }</span>
			<span>{ actions }</span>
		</Row>
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
		<Column>
			<Row>
				<span>ID</span>
				<span>Name</span>
				<span>Created</span>
				<span>Status</span>
				<span>Online Characters</span>
				<span>Actions</span>
			</Row>
			{ friendsWithStatus.map((friend) => (
				<FriendRow key={ friend.id } { ...friend } />
			)) }
		</Column>
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
	return (
		<Row>
			<span>{ id }</span>
			<span>{ name }</span>
			<span>{ new Date(time).toLocaleString() }</span>
			<span>{ status }</span>
			<span>{ characters?.length !== 0 ? 'yes' : 'no' }</span>
			<span>
				<Button className='slim' onClick={
					() => void directory.awaitResponse('unfriend', { id }).catch(() => { /* ignore */ })
				}>Remove
				</Button>
			</span>
		</Row>
	);
}
