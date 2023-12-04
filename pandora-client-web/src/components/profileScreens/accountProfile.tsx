import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { AccountId, AccountPublicInfo, AccountRoleSchema, IClientDirectoryNormalResult } from 'pandora-common';
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
				<strong>Failed to load account data</strong>
				<span>The account doesn't exist or you don't have permission to view its profile.</span>
			</Column>
		);
	}

	return <AccountProfileContent accountData={ accountData } />;
}

function AccountProfileContent({ accountData }: { accountData: AccountPublicInfo; }): ReactElement {
	return (
		<Column className='profileView flex-1' padding='medium' overflowY='auto'>
			<span className='profileHeader'>
				Profile of user&nbsp;
				<strong
					className='selectable'
					style={ {
						textShadow: `${accountData.labelColor} 1px 2px`,
					} }
				>
					{ accountData.displayName }
				</strong>
				<hr />
			</span>
			<span>
				Titles:&nbsp;
				{
					accountData.visibleRoles.length > 0 ? (
						AccountRoleSchema.options
							.filter((role) => accountData.visibleRoles.includes(role))
							.map((role) => _.startCase(role))
							.join(', ')
					) : (
						<i>None</i>
					)
				}
			</span>
			<span>Account id: <span className='selectable-all'>{ accountData.id }</span></span>
			<span>Member since: { new Date(accountData.created).toLocaleDateString() }</span>
			<Row alignY='center'>
				<span>Label color:</span>
				<div className='labelColorMark' style={ { backgroundColor: accountData.labelColor } } />
				<span className='selectable'>{ accountData.labelColor.toUpperCase() }</span>
			</Row>
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
