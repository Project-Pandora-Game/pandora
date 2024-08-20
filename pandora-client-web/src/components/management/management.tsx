import { IsAuthorized } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useObservable } from '../../observable';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { BetaKeys } from './betaKeys/betaKeys';
import './management.scss';
import { Roles } from './roles/roles';
import { Shards } from './shards/shards';

export function ManagementRoutes(): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const account = useCurrentAccount();
	const isDeveloper = account?.roles !== undefined && IsAuthorized(account.roles, 'developer');
	if (!isDeveloper)
		throw new Error('not authorized');

	return (
		<div className='management'>
			<div className='management-header'>
				<Link to='/management/shards'>Shards</Link>
				<Link to='/management/roles'>Roles</Link>
				{ directoryStatus.betaKeyRequired && <Link to='/management/beta_keys'>Beta Keys</Link> }
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
