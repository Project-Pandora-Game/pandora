import React, { ReactElement } from 'react';
import './header.scss';
import { currentAccount, Logout } from '../../networking/account_manager';

function LeftHeader(): ReactElement {
	return (
		<div className="leftHeader">
			{/*
			<div className="headerButton"><img className='avatar' src='/iconClare.png' />Clare</div>
			<div className="headerButton">Inventory</div>
			<div className="headerButton">Room</div>
			*/}
		</div>
	);
}

function RightHeader(): ReactElement {
	const account = currentAccount.useHook();
	const elements: ReactElement[] = [];
	if (account != null) {
		elements.push(
			<div className="headerButton" onClick={ Logout }><img src="/logout.svg" /></div>,
			<div className="headerButton">{ account }</div>,
			<div className="headerButton"><img src="/setting.svg" /></div>,
			<div className="headerButton"><img src="/friends.svg" /></div>,
			<div className="headerButton">
				<span className="notificationContainer">
					<img src="/notification.svg" />
					<div className="counter">5</div>
				</span>
			</div>,
		);
	} else {
		elements.push(
			<div className="headerButton">[not logged in]</div>,
		);
	}
	return (
		<div className="rightHeader">
			{...elements}
		</div>
	);
}

export function Header(): ReactElement {
	return (
		<header>
			<LeftHeader />
			<RightHeader />
		</header>
	);
}
