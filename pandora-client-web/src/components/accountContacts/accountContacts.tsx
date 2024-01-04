import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AccountId, IAccountFriendStatus, IAccountContact } from 'pandora-common';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs';
import { DirectMessages } from '../directMessages/directMessages';
import { Button } from '../common/button/button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { NotificationSource, useNotificationSuppressed } from '../gameContext/notificationContextProvider';
import { useAsyncEvent } from '../../common/useEvent';
import _ from 'lodash';
import { DivContainer, Row } from '../common/container/container';
import { AccountContactChangeHandleResult, useFriendStatus, useAccountContacts } from './accountContactContext';
import { useConfirmDialog } from '../dialog/dialog';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';
import './accountContacts.scss';

export function AccountContacts() {
	const navigate = useNavigate();

	useKeyDownEvent(React.useCallback(() => {
		navigate('/');
		return true;
	}, [navigate]), 'Escape');

	return (
		<div className='accountContacts'>
			<UrlTabContainer>
				<UrlTab name={ <AccountContactHeader type='friend' /> } urlChunk=''>
					<ShowFriends />
				</UrlTab>
				<UrlTab name='Direct messages' urlChunk='dm'>
					<DirectMessages />
				</UrlTab>
				<UrlTab name='Blocked' urlChunk='blocked'>
					<ShowAccountContacts type='blocked' />
				</UrlTab>
				<UrlTab name={ <AccountContactHeader type='pending' /> } urlChunk='pending'>
					<ShowAccountContacts type='pending' />
				</UrlTab>
				<UrlTab name={ <AccountContactHeader type='incoming' /> } urlChunk='incoming'>
					<ShowAccountContacts type='incoming' />
					<ClearIncoming />
				</UrlTab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
			</UrlTabContainer>
		</div>
	);
}

function AccountContactHeader({ type }: { type: IAccountContact['type']; }) {
	const count = useAccountContacts(type).length;

	return (
		<>
			{ type === 'friend' ? 'Contacts' : _.capitalize(type) } ({ count })
		</>
	);
}

function ClearIncoming() {
	useNotificationSuppressed(NotificationSource.INCOMING_FRIEND_REQUEST);
	return null;
}

function ShowAccountContacts({ type }: { type: IAccountContact['type']; }) {
	const rel = useAccountContacts(type);
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
					<AccountContactsRow key={ r.id } { ...r } />
				)) }
			</tbody>
		</table>
	);
}

function AccountContactsRow({
	id,
	displayName,
	time,
	type,
}: {
	id: AccountId;
	displayName: string;
	time: number;
	type: IAccountContact['type'];
}) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const actions = useMemo(() => {
		switch (type) {
			case 'blocked':
				return (
					<Button className='slim' onClick={
						() => void confirm('Confirm unblock', `Are you sure you want to unblock ${displayName}?`).then((result) => {
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
	}, [type, displayName, id, directory, confirm]);
	return (
		<tr>
			<td>{ id }</td>
			<td>{ displayName }</td>
			<td>{ new Date(time).toLocaleString() }</td>
			<td>{ actions }</td>
		</tr>
	);
}

function PendingRequestActions({ id }: { id: AccountId; }) {
	const directory = useDirectoryConnector();
	const [cancel, cancelInProgress] = useAsyncEvent(async () => {
		return await directory.awaitResponse('friendRequest', { id, action: 'cancel' });
	}, AccountContactChangeHandleResult);
	return (
		<Button className='slim' onClick={ cancel } disabled={ cancelInProgress }>Cancel</Button>
	);
}

function IncomingRequestActions({ id }: { id: AccountId; }) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const [accept, acceptInProgress] = useAsyncEvent(async () => {
		if (await confirm('Confirm addition', `Accept the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'accept' });
		}
		return undefined;
	}, AccountContactChangeHandleResult);
	const [decline, declineInProgress] = useAsyncEvent(async () => {
		if (await confirm('Confirm rejection', `Decline the request to add ${id} to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'decline' });
		}
		return undefined;
	}, AccountContactChangeHandleResult);
	return (
		<>
			<Button className='slim' onClick={ accept } disabled={ acceptInProgress }>Accept</Button>
			<Button className='slim' onClick={ decline } disabled={ declineInProgress }>Decline</Button>
		</>
	);
}

function ShowFriends() {
	const friends = useAccountContacts('friend');
	const status = useFriendStatus();
	const friendsWithStatus = useMemo(() => {
		return friends.map((friend) => {
			const stat = status.find((s) => s.id === friend.id);
			return {
				id: friend.id,
				displayName: friend.displayName,
				labelColor: (stat?.online ? stat?.labelColor : null) ?? 'transparent', // We hide the label coloring if account is offline, as we can't get it without loading the account from DB
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

export function useGoToDM(id: AccountId) {
	const directory = useDirectoryConnector();
	const navigate = useNavigate();
	return React.useCallback(() => {
		directory.directMessageHandler.setSelected(id);
		navigate('/contacts/dm');
	}, [directory.directMessageHandler, id, navigate]);
}

function FriendRow({
	id,
	displayName,
	labelColor,
	time,
	online,
	characters,
}: {
	id: AccountId;
	displayName: string;
	labelColor: string;
	time: number;
	online: boolean;
	characters?: IAccountFriendStatus['characters'];
}) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const navigate = useNavigate();
	const location = useLocation();

	const [unfriend, processing] = useAsyncEvent(async () => {
		if (await confirm('Confirm removal', `Are you sure you want to remove ${displayName} from your contacts list?`)) {
			return await directory.awaitResponse('unfriend', { id });
		}
		return undefined;
	}, AccountContactChangeHandleResult);

	const message = useGoToDM(id);

	const viewProfile = useCallback(() => {
		navigate(`/profiles/account/${id}`, {
			state: {
				back: location.pathname,
			},
		});
	}, [navigate, id, location.pathname]);

	return (
		<tr className={ online ? 'friend online' : 'friend offline' }>
			<td className='selectable'>{ id }</td>
			<td
				className='selectable'
				style={ {
					textShadow: `${labelColor} 1px 1px`,
				} }
			>
				{ displayName }
			</td>
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
				<DivContainer direction='row' gap='small'>
					<Button className='slim' onClick={ message }>
						Message
					</Button>
					<Button className='slim' onClick={ viewProfile }>
						Profile
					</Button>
					<Button className='slim' onClick={ unfriend } disabled={ processing }>
						Remove
					</Button>
				</DivContainer>
			</td>
		</tr>
	);
}
