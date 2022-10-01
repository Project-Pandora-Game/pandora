import classNames from 'classnames';
import { EMPTY, IsAuthorized } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
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
import { useNotificationHeader } from '../gameContext/notificationContextProvider';
import { useEvent } from '../../common/useEvent';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';

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
	const [notification, clearNotifications] = useNotificationHeader();
	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

	const onNotificationClick = useEvent((_: React.MouseEvent<HTMLButtonElement>) => {
		clearNotifications();
		toast('Not implemented yet, notifications cleared', TOAST_OPTIONS_ERROR);
	});

	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<HeaderButton icon={ notificationsIcon } iconAlt={ `${ notification.length } notifications` }
						badge={ notification.length } onClick={ onNotificationClick } title='Notifications' />
					<HeaderButton icon={ friendsIcon } iconAlt='Friends' onClick={ () => navigate('/direct_messages') } title='Friends' />
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

export function Header(): ReactElement {
	return (
		<header className='Header'>
			<LeftHeader />
			<RightHeader />
		</header>
	);
}
