import React, { ReactElement } from 'react';
import friendsIcon from '../../assets/icons/friends.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import { currentAccount, Logout } from '../../networking/account_manager';
import { useObservable } from '../../observable';
import './header.scss';
import { HeaderButton } from './HeaderButton';

function LeftHeader(): ReactElement {
	return (
		<div className='leftHeader flex'>
			{/*
			<div className="headerButton"><img className='avatar' src='/iconClare.png' />Clare</div>
			<div className="headerButton">Inventory</div>
			<div className="headerButton">Room</div>
			*/ }
		</div>
	);
}

function RightHeader(): ReactElement {
	const account = useObservable(currentAccount);
	const loggedIn = account !== undefined;
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
