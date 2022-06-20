import { IsAuthorized } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useCurrentAccount } from '../gameContext/directoryConnectorContextProvider';
import { Shards } from './shards/shards';
import { Roles } from './roles/roles';
import './management.scss';

export function ManagementRoutes(): ReactElement | null {
	const account = useCurrentAccount();
	const isDeveloper = account?.roles !== undefined && IsAuthorized(account.roles, 'developer');
	if (!isDeveloper)
		throw new Error('not authorized');

	return (
		<div className='management'>
			<div className='management-header'>
				<Link to='/management/shards'>Shards</Link>
				<Link to='/management/roles'>Roles</Link>
			</div>
			<Routes>
				<Route path='*' element={ <div /> } />
				<Route path='/shards' element={ <Shards /> } />
				<Route path='/roles' element={ <Roles /> } />
			</Routes>
		</div>
	);
}

