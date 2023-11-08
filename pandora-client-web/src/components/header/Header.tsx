import classNames from 'classnames';
import { IsAuthorized } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import friendsIcon from '../../assets/icons/friends.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import wikiIcon from '../../assets/icons/wiki.svg';
import managementIcon from '../../assets/icons/management.svg';
import { usePlayerData, usePlayerState } from '../gameContext/playerContextProvider';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import './header.scss';
import { HeaderButton } from './HeaderButton';
import { NotificationHeaderKeys, NotificationSource, useNotification, useNotificationHeader } from '../gameContext/notificationContextProvider';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { DirectMessageChannel } from '../../networking/directMessageManager';
import { useCharacterSafemode } from '../../character/character';
import { useSafemodeDialogContext } from '../characterSafemode/characterSafemode';
import { RelationshipContext, useRelationships } from '../releationships/relationshipsContext';
import { useObservable } from '../../observable';
import { LeaveButton } from './leaveButton';
import { useIsNarrowScreen } from '../../styles/mediaQueries';
import { Column, Row } from '../common/container/container';
import { DialogInPortal } from '../dialog/dialog';
import { IconCross, IconHamburger } from '../common/button/domIcons';

function LeftHeader(): ReactElement {
	const connectionInfo = useShardConnectionInfo();

	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	const [showCharacterMenu, setShowCharacterMenu] = useState<boolean>(false);

	return (
		<div className='leftHeader flex'>
			{ /*
			<div className="headerButton"><img className='avatar' src='/iconClare.png' />Clare</div>
			<div className="headerButton">Inventory</div>
			<div className="headerButton">Room</div>
			*/ }
			{ connectionInfo && (
				<button className={ classNames('HeaderButton', 'withText', showCharacterMenu && 'active') } onClick={ (ev) => {
					ev.currentTarget.focus();
					setShowCharacterMenu(!showCharacterMenu);
				} }>
					<span className='label'>Current character:</span>
					{ characterName ?? `[Character ${connectionInfo.characterId}]` }
				</button>
			) }
			{ !connectionInfo && (
				<span>
					<span className='label'>Current character:</span>
					[no character selected]
				</span>
			) }
			{ connectionInfo && showCharacterMenu && <CharacterMenu close={ () => setShowCharacterMenu(false) } /> }
		</div>
	);
}

function CharacterMenu({ close }: { close: () => void; }): ReactElement {
	const { playerState } = usePlayerState();

	const safemode = useCharacterSafemode(playerState);
	const safemodeContext = useSafemodeDialogContext();

	return (
		<div className='characterMenu' onClick={ () => close() }>
			<header onClick={ (ev) => ev.stopPropagation() }>Character menu</header>
			<a onClick={ (ev) => {
				ev.preventDefault();
				safemodeContext.show();
			} }>
				{ safemode ? 'Exit' : 'Enter' } safemode
			</a>
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
	const unreadDirectMessageCount = useObservable(handler.info).filter((info) => info.hasUnread).length;
	const incomingFriendRequestCount = useRelationships('incoming').length;
	const notificationCount = unreadDirectMessageCount + incomingFriendRequestCount;

	useEffect(() => handler.on('newMessage', (channel: DirectMessageChannel) => {
		if (channel.mounted && document.visibilityState === 'visible')
			return;

		notifyDirectMessage({
			// TODO: notification
		});
	}), [handler, notifyDirectMessage]);

	const notifyFriendRequest = useNotification(NotificationSource.INCOMING_FRIEND_REQUEST);
	useEffect(() => RelationshipContext.on('incoming', () => notifyFriendRequest({
		// TODO: ...
	})), [notifyFriendRequest]);

	return (
		<HeaderButton
			icon={ friendsIcon }
			iconAlt={ `${ notificationCount } Contacts` }
			title='Contacts'
			badge={ notificationCount }
			onClick={ () => {
				navigate('/relationships');
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
		<DialogInPortal priority={ 5 }>
			<Column className={ classNames('OverlayHeader', visible ? null : 'hide') }>
				<Row>
					<button className='HeaderButton' onClick={ close }>
						<IconCross />
					</button>
				</Row>

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
	const currentAccount = useCurrentAccount();
	const [showMenu, setShowMenu] = useState(false);

	return (
		<Row alignX='space-between' alignY='center' className='flex-1'>
			<button className='HeaderButton' onClick={ () => {
				setShowMenu(true);
			} }>
				<IconHamburger />
			</button>
			<span>{ currentAccount != null ? currentAccount.username : '[not logged in]' }</span>
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
