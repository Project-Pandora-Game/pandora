import { IsAuthorized } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { Shards } from './shards/shards';
import { Roles } from './roles/roles';
import { BetaKeys } from './betaKeys/betaKeys';
import './management.scss';
import { useObservable } from '../../observable';

export function ManagementRoutes(): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const account = useObservable(directoryConnector.currentAccount);
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
				{ directoryStatus.betaKeyRequired && <Route path='/beta_keys' element={ <BetaKeys /> } /> }
			</Routes>
		</div>
	);
}
