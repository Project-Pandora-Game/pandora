import { IsAuthorized } from 'pandora-common';
import { ReactElement } from 'react';
import { useObservable } from '../../observable.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { ManagementAccounts } from './account/account.tsx';
import { BetaKeys } from './betaKeys/betaKeys.tsx';
import './management.scss';
import { ServerManagement } from './server/server.tsx';
import { Shards } from './shards/shards.tsx';

export function ManagementRoutes(): ReactElement | null {
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const account = useCurrentAccount();
	const isDeveloper = account?.roles !== undefined && IsAuthorized(account.roles, 'developer');
	if (!isDeveloper)
		throw new Error('not authorized');

	return (
		<UrlTabContainer className='flex-1' allowWrap noImplicitDefaultTab>
			<UrlTab name='Shards' urlChunk='shards'>
				<Shards />
			</UrlTab>
			<UrlTab name='Accounts' urlChunk='accounts'>
				<ManagementAccounts />
			</UrlTab>
			{
				(directoryStatus.betaKeyRequired) ? (
					<UrlTab name='Beta Keys' urlChunk='beta_keys'>
						<BetaKeys />
					</UrlTab>
				) : null
			}
			<UrlTab name='Server' urlChunk='server'>
				<ServerManagement />
			</UrlTab>
			<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
		</UrlTabContainer>
	);
}
