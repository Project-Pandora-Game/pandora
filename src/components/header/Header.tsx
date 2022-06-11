import classNames from 'classnames';
import { EMPTY } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import friendsIcon from '../../assets/icons/friends.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import { usePlayerData } from '../../character/player';
import { useLogout } from '../../networking/account_manager';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import './header.scss';
import { HeaderButton } from './HeaderButton';

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
				<button className={ classNames('HeaderButton', showCharacterMenu && 'active') } onClick={ (ev) => {
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
		<div className='characterMenu'>
			<header>Character menu</header>
			<a onClick={ (ev) => {
				close();
				ev.preventDefault();
				directoryConnector.sendMessage('disconnectCharacter', EMPTY);
			} }>
				Change character
			</a>
		</div>
	);
}

function RightHeader(): ReactElement {
	const currentAccount = useCurrentAccount();
	const logout = useLogout();
	const loggedIn = currentAccount != null;
	const notificationCount = 0;
	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<HeaderButton icon={ notificationsIcon } iconAlt={ `${ notificationCount } notifications` }
						badge={ notificationCount } onClick={ () => alert('Not yet implemented') } title='Notifications' />
					<HeaderButton icon={ friendsIcon } iconAlt='Friends' onClick={ () => alert('Not yet implemented') } title='Friends' />
					<HeaderButton icon={ settingsIcon } iconAlt='Settings' onClick={ () => alert('Not yet implemented') } title='Settings' />
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
