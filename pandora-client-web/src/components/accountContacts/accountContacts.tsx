import { AccountId, IAccountContact, IAccountFriendStatus, type AccountOnlineStatus } from 'pandora-common';
import React, { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router';
import statusIconAway from '../../assets/icons/state-away.svg';
import statusIconDND from '../../assets/icons/state-dnd.svg';
import statusIconLookingDom from '../../assets/icons/state-dom.svg';
import statusIconOffline from '../../assets/icons/state-offline.svg';
import statusIconOnline from '../../assets/icons/state-online.svg';
import statusIconLookingSub from '../../assets/icons/state-sub.svg';
import statusIconLookingSwitch from '../../assets/icons/state-switch.svg';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { useKeyDownEvent } from '../../common/useKeyDownEvent.ts';
import { useObservable, useObservableMultiple } from '../../observable.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { NotificationSuppressionHook, useNotificationSuppress } from '../../services/notificationHandler.tsx';
import { useService } from '../../services/serviceProvider.tsx';
import { Button } from '../common/button/button.tsx';
import { DivContainer, Row } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs.tsx';
import { useConfirmDialog } from '../dialog/dialog.tsx';
import { DirectMessages } from '../directMessages/directMessages.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { AccountContactChangeHandleResult, useAccountContacts, useFriendStatus } from './accountContactContext.ts';
import './accountContacts.scss';

export function AccountContacts() {
	const navigate = useNavigatePandora();
	const directMessageManager = useService('directMessageManager');

	useKeyDownEvent(React.useCallback(() => {
		navigate('/');
		return true;
	}, [navigate]), 'Escape');

	const unreadDirectMessageCount = useObservableMultiple(
		useObservable(directMessageManager.chats)
			.map((c) => c.displayInfo),
	).filter((c) => c.hasUnread).length;
	const pending = useAccountContacts('pending').length;
	const incoming = useAccountContacts('incoming').length;

	return (
		<div className='accountContacts'>
			<UrlTabContainer allowWrap>
				<UrlTab name='Contacts' urlChunk=''>
					<ShowFriends />
				</UrlTab>
				<UrlTab name='Direct messages' urlChunk='dm' badge={ unreadDirectMessageCount > 0 ? `${unreadDirectMessageCount}` : null }>
					<DirectMessages />
				</UrlTab>
				<UrlTab name='Blocked' urlChunk='blocked'>
					<ShowAccountContacts type='blocked' />
				</UrlTab>
				<UrlTab name='Pending' urlChunk='pending' badge={ pending > 0 ? `${pending}` : null } badgeType='passive'>
					<ShowAccountContacts type='pending' />
				</UrlTab>
				<UrlTab name='Incoming' urlChunk='incoming' badge={ incoming > 0 ? `${incoming}` : null }>
					<ShowAccountContacts type='incoming' />
					<ClearIncoming />
				</UrlTab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
			</UrlTabContainer>
		</div>
	);
}

function ClearIncoming() {
	useNotificationSuppress(useCallback<NotificationSuppressionHook>((notification) => {
		return notification.type === 'contactsNewContactRequest';
	}, []));
	return null;
}

function ShowAccountContacts({ type }: { type: IAccountContact['type']; }) {
	const rel = useAccountContacts(type);
	return (
		<Scrollable>
			<table className='fill-x'>
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
		</Scrollable>
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
				return <PendingRequestActions id={ id } displayName={ displayName } />;
			case 'incoming':
				return <IncomingRequestActions id={ id } displayName={ displayName } />;
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

function PendingRequestActions({ id }: { id: AccountId; displayName: string; }) {
	const directory = useDirectoryConnector();
	const [cancel, cancelInProgress] = useAsyncEvent(async () => {
		return await directory.awaitResponse('friendRequest', { id, action: 'cancel' });
	}, AccountContactChangeHandleResult);
	return (
		<Button className='slim' onClick={ cancel } disabled={ cancelInProgress }>Cancel</Button>
	);
}

function IncomingRequestActions({ id, displayName }: { id: AccountId; displayName: string; }) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const [accept, acceptInProgress] = useAsyncEvent(async () => {
		if (await confirm('Confirm addition', `Accept the request to add ${displayName} (${id}) to your contacts?`)) {
			return await directory.awaitResponse('friendRequest', { id, action: 'accept' });
		}
		return undefined;
	}, AccountContactChangeHandleResult);
	const [decline, declineInProgress] = useAsyncEvent(async () => {
		if (await confirm('Confirm rejection', `Decline the request to add ${displayName} (${id}) to your contacts?`)) {
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
			return (
				<FriendRow key={ friend.id }
					id={ friend.id }
					displayName={ friend.displayName }
					// We hide the label coloring if account is offline, as we can't get it without loading the account from DB
					labelColor={ ((stat?.status !== 'offline') ? stat?.labelColor : null) ?? 'transparent' }
					time={ friend.time }
					status={ stat?.status ?? 'offline' }
					characters={ stat?.characters }
				/>
			);
		});
	}, [friends, status]);

	return (
		<Scrollable direction='vertical'>
			<table className='fill-x'>
				<colgroup>
					<col style={ { width: '1%' } } />
					<col />
					<col style={ { width: '1%' } } />
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
					{ friendsWithStatus }
				</tbody>
			</table>
		</Scrollable>
	);
}

export function GetAccountDMUrl(target: AccountId): string {
	return `/contacts/dm/${target}`;
}

export function useGoToDM(id: AccountId) {
	const navigate = useNavigatePandora();
	return useCallback(() => {
		navigate(GetAccountDMUrl(id));
	}, [id, navigate]);
}

export const FRIEND_STATUS_ICONS: Record<AccountOnlineStatus, string> = {
	'online': statusIconOnline,
	'looking-switch': statusIconLookingSwitch,
	'looking-dom': statusIconLookingDom,
	'looking-sub': statusIconLookingSub,
	'away': statusIconAway,
	'dnd': statusIconDND,
	'offline': statusIconOffline,
};

export const FRIEND_STATUS_NAMES: Record<AccountOnlineStatus, string> = {
	'online': 'Online',
	'looking-switch': 'Looking to play',
	'looking-dom': 'Looking to dom',
	'looking-sub': 'Looking to sub',
	'away': 'Away',
	'dnd': 'Do Not Disturb',
	'offline': 'Offline',
};

function FriendRow({
	id,
	displayName,
	labelColor,
	time,
	status,
	characters,
}: {
	id: AccountId;
	displayName: string;
	labelColor: string;
	time: number;
	status: AccountOnlineStatus;
	characters?: IAccountFriendStatus['characters'];
}) {
	const directory = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const navigate = useNavigatePandora();
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
		<tr className={ (status !== 'offline') ? 'friend online' : 'friend offline' }>
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
				<Row alignX='start' alignY='center'>
					<img
						className='indicator'
						src={ FRIEND_STATUS_ICONS[status] }
						alt={ FRIEND_STATUS_NAMES[status] }
					/>
					<span>
						{ FRIEND_STATUS_NAMES[status] }
					</span>
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
