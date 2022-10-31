import classNames from 'classnames';
import { EMPTY, IsAuthorized } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import friendsIcon from '../../assets/icons/friends.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import managementIcon from '../../assets/icons/management.svg';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useLogout } from '../../networking/account_manager';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import './header.scss';
import { HeaderButton } from './HeaderButton';
import { NotificationHeaderKeys, NotificationSource, useNotification, useNotificationHeader } from '../gameContext/notificationContextProvider';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { DirectMessageChannel } from '../../networking/directMessageManager';

function LeftHeader(): ReactElement {
	const connectionInfo = useShardConnectionInfo();

	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	const [showCharacterMenu, setShowCharacterMenu] = useState<boolean>(false);

	return (
		<div className='leftHeader flex'>
			{/*
			<div className="headerButton"><img className='avatar' src='/iconClare.png' />Clare</div>
			<div className="headerButton">Inventory</div>
			<div className="headerButton">Room</div>
			*/ }
			{ connectionInfo && (
				<button className={ classNames('HeaderButton', 'withText', showCharacterMenu && 'active') } onClick={ (ev) => {
					ev.currentTarget.focus();
					setShowCharacterMenu(!showCharacterMenu);
				} }>
					{ characterName ?? `[Character ${connectionInfo.characterId}]` }
				</button>
			) }
			{ !connectionInfo && <span>[no character selected]</span> }
			{ connectionInfo && showCharacterMenu && <CharacterMenu close={ () => setShowCharacterMenu(false) } /> }
		</div>
	);
}

function CharacterMenu({ close }: { close: () => void }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	return (
		<div className='characterMenu' onClick={ () => close() }>
			<header onClick={ (ev) => ev.stopPropagation() }>Character menu</header>
			<a onClick={ (ev) => {
				ev.preventDefault();
				directoryConnector.sendMessage('disconnectCharacter', EMPTY);
			} }>
				Change character
			</a>
			<Link to='/character_settings'>
				Character settings
			</Link>
		</div>
	);
}

function RightHeader(): ReactElement {
	const currentAccount = useCurrentAccount();
	const logout = useLogout();
	const navigate = useNavigate();
	const loggedIn = currentAccount != null;

	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<NotificationButton icon={ notificationsIcon } title='Notifications' type='notifications' onClick={ () => toast('Not implemented yet, notifications cleared', TOAST_OPTIONS_ERROR) } />
					<FriendsHeaderButton />
					<HeaderButton icon={ settingsIcon } iconAlt='Settings' onClick={ () => navigate('/account_settings') } title='Settings' />
					{ isDeveloper && <HeaderButton icon={ managementIcon } iconAlt='Settings' onClick={ () => navigate('/management') } title='Management' /> }
					<span>{ currentAccount.username }</span>
					<HeaderButton icon={ logoutIcon } iconAlt='Logout' onClick={ logout } title='Logout' />
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
			onClick={ onNotificationClick }  />
	);
}

function FriendsHeaderButton(): ReactElement {
	const navigate = useNavigate();
	const handler = useDirectoryConnector().directMessageHandler;
	const { notify } = useNotification(NotificationSource.DIRECT_MESSAGE);

	useEffect(() => handler.on('newMessage', (channel: DirectMessageChannel) => {
		if (channel.mounted && document.visibilityState === 'visible')
			return;

		notify({
			// TODO: notification
		});
	}), [handler, notify]);

	return (
		<NotificationButton
			icon={ friendsIcon }
			title='Friends'
			type='friends'
			onClick={ () => navigate('/direct_messages') } />
	);
}

export function Header(): ReactElement {
	return (
		<header className='Header'>
			<LeftHeader />
			<RightHeader />
		</header>
	);
}
