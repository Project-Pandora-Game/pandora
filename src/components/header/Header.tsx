import classNames from 'classnames';
import { EMPTY } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import friendsIcon from '../../assets/icons/friends.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import { usePlayerData } from '../../character/player';
import { currentAccount, Logout } from '../../networking/account_manager';
import { DirectoryConnector } from '../../networking/socketio_directory_connector';
import { ShardConnector } from '../../networking/socketio_shard_connector';
import { useObservable } from '../../observable';
import './header.scss';
import { HeaderButton } from './HeaderButton';

function LeftHeader(): ReactElement {
	const shardConnector = useObservable(ShardConnector);

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
			{ shardConnector && (
				<button className={ classNames('HeaderButton', showCharacterMenu && 'active') } onClick={ (ev) => {
					ev.currentTarget.focus();
					setShowCharacterMenu(!showCharacterMenu);
				} }>
					{ characterName ?? `[Character ${shardConnector.connectionInfo.characterId}]` }
				</button>
			) }
			{ !shardConnector && <span>[no character selected]</span> }
			{ shardConnector && showCharacterMenu && <CharacterMenu close={ () => setShowCharacterMenu(false) } /> }
		</div>
	);
}

function CharacterMenu({ close }: { close: () => void }): ReactElement {
	return (
		<div className='characterMenu'>
			<header>Character menu</header>
			<a onClick={ (ev) => {
				close();
				ev.preventDefault();
				DirectoryConnector.sendMessage('disconnectCharacter', EMPTY);
			} }>
				Change character
			</a>
		</div>
	);
}

function RightHeader(): ReactElement {
	const account = useObservable(currentAccount);
	const loggedIn = account != null;
	const notificationCount = 5;
	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<HeaderButton icon={ notificationsIcon } iconAlt={ `${ notificationCount } notifications` }
						badge={ notificationCount } title='Notifications' />
					<HeaderButton icon={ friendsIcon } iconAlt='Friends icon' title='Friends' />
					<HeaderButton icon={ settingsIcon } iconAlt='Settings icon' title='Settings' />
					<span>{ account.username }</span>
					<HeaderButton icon={ logoutIcon } iconAlt='Logout icon' onClick={ Logout } title='Logout' />
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
