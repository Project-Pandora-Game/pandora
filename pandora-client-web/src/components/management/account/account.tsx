import { AccountId, FormatTimeInterval, GetLogger, ManagementAccountQueryResult, type ManagementAccountInfo } from 'pandora-common';
import React, { useCallback, useEffect, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { Roles } from './roles.tsx';

export function ManagementAccounts(): ReactElement {
	const connector = useDirectoryConnector();
	const [id, setId] = useState<AccountId>(0);
	const [data, setData] = useState<ManagementAccountQueryResult | null>(null);

	const loadAccount = useCallback(() => {
		if (!Number.isSafeInteger(id) || id <= 0)
			return;

		connector.awaitResponse('manageAccountGet', { id })
			.then((result) => {
				setData(result);
			})
			.catch((err) => {
				GetLogger('ManagementAccounts').warning('Error getting account data:', err);
				toast('Error getting account data', TOAST_OPTIONS_ERROR);
			});
	}, [connector, id]);

	useEffect(() => {
		loadAccount();
	}, [loadAccount]);

	return (
		<Column alignX='center' padding='medium'>
			<FieldsetToggle legend='Select account'>
				<Row alignY='center'>
					<label>Account ID</label>
					<NumberInput value={ id } min={ 0 } onChange={ (newValue) => {
						setId(newValue);
						setData(null);
					} } />
				</Row>
				<Button slim onClick={ loadAccount }>
					Update
				</Button>
			</FieldsetToggle>
			{
				(data?.result === 'ok' && data.info.id === id) ? (
					<ManagementAccountDetails
						info={ data.info }
						reload={ loadAccount }
					/>
				) : data?.result === 'notFound' ? (
					<h2>Account not found</h2>
				) : (!Number.isSafeInteger(id) || id <= 0) ? (
					null
				) : (
					<span>Loading...</span>
				)
			}
		</Column>
	);
}

function ManagementAccountDetails({ info, reload }: {
	info: ManagementAccountInfo;
	reload: () => void;
}): ReactElement {
	const now = useCurrentTime(60_000);

	return (
		<Column>
			<FieldsetToggle legend='Basic info' className='selectable'>
				<Column gap='small'>
					<Row alignY='center'>
						<span>ID:</span><span>{ info.id }</span>
					</Row>
					<Row alignY='center'>
						<span>Username:</span><span>{ info.username }</span>
					</Row>
					<Row alignY='center'>
						<span>Display name:</span><span>{ info.displayName }</span>
					</Row>
					<Row alignY='center'>
						<span>Created:</span><span>{ new Date(info.created).toUTCString() } ({ FormatTimeInterval(now - info.created, 'two-most-significant') } ago)</span>
					</Row>
					<Row alignY='center'>
						<span>Status:</span><span>{ info.onlineStatus != null ? `Online (${info.onlineStatus})` : 'Offline' }</span>
					</Row>
					<Row alignY='center'>
						<ExternalLink href={ `/profiles/account/${encodeURIComponent(info.id)}` }>
							View profile
						</ExternalLink>
					</Row>
				</Column>
			</FieldsetToggle>
			<FieldsetToggle legend='Security' className='selectable'>
				<Column gap='small'>
					<Row alignY='center'>
						<span>Account active:</span><span>{ String(info.secure.activated) }</span>
					</Row>
					<Row alignY='center'>
						<span>GitHub link:</span>
						<span className='display-linebreak'>{ info.secure.githubLink != null ? JSON.stringify(info.secure.githubLink, undefined, '    ') : <i>None</i> }</span>
					</Row>
				</Column>
			</FieldsetToggle>
			<FieldsetToggle legend='Roles'>
				<Roles
					id={ info.id }
					roles={ info.roles }
					reload={ reload }
				/>
			</FieldsetToggle>
			<FieldsetToggle legend='Characters' className='selectable'>
				<Column>
					{
						info.characters.map((c, index) => (
							<React.Fragment key={ c.id }>
								{
									index !== 0 ? (
										<hr className='fill-x' />
									) : null
								}
								<Column gap='small'>
									<Row alignY='center'>
										<span>ID:</span><span>{ c.id }</span>
									</Row>
									<Row alignY='center'>
										<span>Name:</span><span>{ c.name }</span>
									</Row>
									<Row alignY='center'>
										<span>State:</span><span>{ c.state } { c.inCreation ? '(in creation)' : null }</span>
									</Row>
									<Row alignY='center'>
										<span>Current space:</span><span>{ c.currentSpace ?? <i>None</i> }</span>
									</Row>
									<Row alignY='center'>
										<ExternalLink href={ `/profiles/character/${encodeURIComponent(c.id)}` }>
											View character profile
										</ExternalLink>
									</Row>
								</Column>
							</React.Fragment>
						))
					}
				</Column>
			</FieldsetToggle>
		</Column>
	);
}
