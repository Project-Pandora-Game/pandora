import React, { ReactElement } from 'react';
import { Navigate } from 'react-router';
import { Link } from 'react-router-dom';
import { GAME_NAME, GAME_VERSION } from '../../config/Environment';
import { authToken } from '../../networking/account_manager';
import { useObservable } from '../../observable';

export function Pandora(): ReactElement {
	const canAuth = !!useObservable(authToken);

	if (canAuth)
		return <Navigate to='/login' />;

	return (
		<div className='Pandora'>
			<h1>Welcome to { GAME_NAME }</h1>
			<span>Game version: { GAME_VERSION }</span>
			<span><p><Link to='/login'>Login</Link></p></span>
		</div>
	);
}
