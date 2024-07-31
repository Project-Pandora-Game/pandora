import classNames from 'classnames';
import { IsAuthorized } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import friendsIcon from '../../assets/icons/friends.svg';
import managementIcon from '../../assets/icons/management.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import wikiIcon from '../../assets/icons/wiki.svg';
import { useObservable, useObservableMultiple } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat';
import { useIsNarrowScreen } from '../../styles/mediaQueries';
import { AccountContactContext, useAccountContacts } from '../accountContacts/accountContactContext';
import { IconHamburger } from '../common/button/domIcons';
import { Column, Row } from '../common/container/container';
import { DialogInPortal } from '../dialog/dialog';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { NotificationHeaderKeys, NotificationSource, useNotification, useNotificationHeader } from '../gameContext/notificationContextProvider';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import { HeaderButton } from './HeaderButton';
import './header.scss';
import { LeaveButton } from './leaveButton';

function LeftHeader(): ReactElement {
	const connectionInfo = useShardConnectionInfo();

	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	return (
		<div className='leftHeader flex'>
			{ /*
			<div className="headerButton"><img className='avatar' src='/iconClare.png' />Clare</div>
			<div className="headerButton">Inventory</div>
			<div className="headerButton">Room</div>
			*/ }
			{ connectionInfo && (
				<span>
					<span className='label'>Current character:</span>
					{ characterName ?? `[Character ${connectionInfo.characterId}]` }
				</span>
			) }
			{ !connectionInfo && (
				<span>
					<span className='label'>Current character:</span>
					[no character selected]
				</span>
			) }
		</div>
	);
}

function RightHeader({ onAnyClick }: {
	onAnyClick?: () => void;
}): ReactElement {
	const currentAccount = useCurrentAccount();
	const navigate = useNavigate();
	const loggedIn = currentAccount != null;

	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<HeaderButton
						icon={ wikiIcon }
						iconAlt='Wiki'
						title='Wiki'
						onClick={ () => {
							navigate('/wiki');
							onAnyClick?.();
						} }
					/>
					<NotificationButton
						icon={ notificationsIcon }
						title='Notifications'
						type='notifications'
						onClick={ () => {
							toast('Not implemented yet, notifications cleared', TOAST_OPTIONS_ERROR);
						} }
					/>
					<FriendsHeaderButton onClickExtra={ onAnyClick } />
					<HeaderButton
						icon={ settingsIcon }
						iconAlt='Settings'
						title='Settings'
						onClick={ () => {
							navigate('/settings');
							onAnyClick?.();
						} }
					/>
					{ isDeveloper && (
						<HeaderButton
							icon={ managementIcon }
							iconAlt='Management'
							title='Management'
							onClick={ () => {
								navigate('/management');
								onAnyClick?.();
							} }
						/>
					) }
					<span>
						<span className='label'>Current account:</span>
						{ currentAccount.username }
					</span>
					<LeaveButton onClickExtra={ onAnyClick } />
				</>
			) }
			{ !loggedIn && <span>[not logged in]</span> }
		</div>
	);
}

function NotificationButton({ icon, title, type, onClick }: {
	icon: string;
	title: string;
	type: NotificationHeaderKeys;
	onClick: (_: React.MouseEvent<HTMLButtonElement>) => void;
}): ReactElement {
	const [notification, clearNotifications] = useNotificationHeader(type);

	const onNotificationClick = useCallback((ev: React.MouseEvent<HTMLButtonElement>) => {
		clearNotifications();
		onClick(ev);
	}, [clearNotifications, onClick]);

	return (
		<HeaderButton
			icon={ icon }
			iconAlt={ `${ notification.length } ${ title }` }
			title={ title }
			badge={ notification.length }
			onClick={ onNotificationClick } />
	);
}

function FriendsHeaderButton({ onClickExtra }: {
	onClickExtra?: () => void;
}): ReactElement {
	const navigate = useNavigate();
	const handler = useDirectoryConnector().directMessageHandler;
	const notifyDirectMessage = useNotification(NotificationSource.DIRECT_MESSAGE);
	const unreadDirectMessageCount = useObservableMultiple(
		useObservable(handler.chats)
			.map((c) => c.displayInfo),
	).filter((c) => c.hasUnread).length;
	const incomingFriendRequestCount = useAccountContacts('incoming').length;
	const notificationCount = unreadDirectMessageCount + incomingFriendRequestCount;

	useEffect(() => handler.on('newMessage', (_chat: DirectMessageChat) => {
		notifyDirectMessage({
			// TODO: notification
		});
	}), [handler, notifyDirectMessage]);

	const notifyFriendRequest = useNotification(NotificationSource.INCOMING_FRIEND_REQUEST);
	useEffect(() => AccountContactContext.on('incoming', () => notifyFriendRequest({
		// TODO: ...
	})), [notifyFriendRequest]);

	return (
		<HeaderButton
			icon={ friendsIcon }
			iconAlt={ `${ notificationCount } Contacts` }
			title='Contacts'
			badge={ notificationCount }
			onClick={ () => {
				navigate('/contacts');
				onClickExtra?.();
			} }
		/>
	);
}

function OverlayHeader({ onClose: close, visible }: {
	onClose: () => void;
	visible: boolean;
}): ReactElement {
	return (
		<DialogInPortal priority={ 5 } location='mainOverlay'>
			<Column className={ classNames('OverlayHeader', visible ? null : 'hide') }>
				<Column className='content'>
					<LeftHeader />
					<hr />
					<RightHeader onAnyClick={ close } />
				</Column>
			</Column>
		</DialogInPortal>
	);
}

function CollapsableHeader(): ReactElement {
	const [showMenu, setShowMenu] = useState(false);

	const currentAccount = useCurrentAccount();
	const connectionInfo = useShardConnectionInfo();
	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	return (
		<Row alignX='space-between' alignY='center' className='flex-1'>
			<span>
				{
					currentAccount == null ? '[not logged in]' :
					connectionInfo == null ? '[no character selected]' :
					(characterName ?? `[Character ${connectionInfo.characterId}]`)
				}
			</span>
			<button className='collapsableHeaderButton' onClick={ () => {
				setShowMenu(!showMenu);
			} }>
				<IconHamburger state={ showMenu ? 'cross' : 'hamburger' } />
			</button>
			<OverlayHeader visible={ showMenu } onClose={ () => setShowMenu(false) } />
		</Row>
	);
}

export function Header(): ReactElement {
	const isNarrow = useIsNarrowScreen();

	return (
		<header className='Header'>
			{
				isNarrow ? (
					<CollapsableHeader />
				) : (
					<>
						<LeftHeader />
						<RightHeader />
					</>
				)
			}
		</header>
	);
}
