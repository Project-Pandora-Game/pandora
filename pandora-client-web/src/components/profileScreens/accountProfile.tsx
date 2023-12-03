import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { AccountId, AccountPublicInfo, IClientDirectoryNormalResult } from 'pandora-common';
import { Column, Row } from '../common/container/container';
import _, { noop } from 'lodash';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';

export function AccountProfile({ accountId }: { accountId: AccountId; }): ReactElement {
	const accountData = useAccountProfileData(accountId);

	if (accountData === undefined) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				Loading...
			</Column>
		);
	}

	if (accountData == null) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				<span>Failed to load account data.</span>
				<span>Either the account doesn't exist or you don't have permission to view their profile.</span>
			</Column>
		);
	}

	return <AccountProfileContent accountData={ accountData } />;
}

function AccountProfileContent({ accountData }: { accountData: AccountPublicInfo; }): ReactElement {
	return (
		<Column className='profileView flex-1' padding='medium' overflowY='auto'>
			<span className='profileHeader'>
				Profile of { accountData.displayName }
				<hr style={ {
					background: '#000',
					color: '#000',
				} } />
			</span>
			<Row>
				<span>Account: { accountData.displayName }</span>
				{
					accountData.visibleRoles.length > 0 ? (
						<span>({ accountData.visibleRoles.map((role) => _.startCase(role)).join(', ') })</span>
					) : null
				}
			</Row>
			<span>Account id: { accountData.id }</span>
			<span>Member since: { new Date(accountData.created).toLocaleDateString() }</span>
		</Column>
	);
}

/**
 * Queries data about a character.
 * @param characterId - The character to query for
 * @returns The character data, `null` if unable to get, `undefined` if in progress
 */
function useAccountProfileData(accountId: AccountId): AccountPublicInfo | null | undefined {
	const [response, setResponse] = useState<IClientDirectoryNormalResult['getAccountInfo']>();
	const directoryConnector = useDirectoryConnector();

	const fetchAccountInfo = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('getAccountInfo', { accountId });
		setResponse(result);
	}, [directoryConnector, accountId]);

	// TODO: Might be nice if we figure out a mechanism to detect changes and trigger update, but it isn't necessarily needed
	useEffect(() => {
		fetchAccountInfo().catch(noop);
	}, [fetchAccountInfo]);

	return response === undefined ? undefined :
		response.result === 'ok' ? response.info :
		null;
}
