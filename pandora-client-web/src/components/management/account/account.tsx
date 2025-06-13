import { AccountId, FormatTimeInterval, GetLogger, ManagementAccountQueryResult, type ManagementAccountInfo } from 'pandora-common';
import React, { useCallback, useEffect, useId, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS, ToastHandlePromise } from '../../../persistentToast.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';
import { ModalDialog, useConfirmDialog } from '../../dialog/dialog.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { HEADER_STATUS_SELECTOR_NAMES } from '../../header/Header.tsx';
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
						key={ data.info.id }
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
	const connector = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const [showDisableDialog, setShowDisableDialog] = useState(false);

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
						<span>Status:</span><span>{ info.onlineStatus != null ? `Online (${HEADER_STATUS_SELECTOR_NAMES[info.onlineStatus]})` : 'Offline' }</span>
					</Row>
					<Row alignY='center'>
						<ExternalLink href={ `/profiles/account/${encodeURIComponent(info.id)}` }>
							View profile
						</ExternalLink>
					</Row>
				</Column>
			</FieldsetToggle>
			<FieldsetToggle legend='Security' className='selectable'>
				<Column gap='small' alignX='start'>
					<Row alignY='center'>
						<span>Account active:</span><span>{ String(info.secure.activated) }</span>
					</Row>
					<Row alignY='center'>
						<span>GitHub link:</span>
						<span className='display-linebreak'>{ info.secure.githubLink != null ? JSON.stringify(info.secure.githubLink, undefined, '    ') : <i>None</i> }</span>
					</Row>
					<Row alignY='center'>
						<span>Ban:</span>
						<span className='display-linebreak'>{ info.secure.disabled != null ? JSON.stringify(info.secure.disabled, undefined, '    ') : <i>None</i> }</span>
					</Row>
					{
						info.secure.disabled != null ? (
							<Button
								onClick={ () => {
									confirm('Restore account', `Are you sure you want to restore account ${info.id}?`)
										.then((confirmation) => {
											if (!confirmation)
												return;

											return ToastHandlePromise(
												connector.awaitResponse('manageAccountDisable', { id: info.id, disable: null }),
												{
													pending: 'Processing request...',
													success: 'Request processed',
													error: 'Error processing request',
												},
											)
												.then((result) => {
													if (result.result === 'ok') {
														toast('Account restored', TOAST_OPTIONS_SUCCESS);
														reload();
													} else {
														toast('Failed to restore account: ' + result.result, TOAST_OPTIONS_ERROR);
													}
												});
										})
										.catch((err) => GetLogger('ManagementAccountDetails').error('Error restoring account:', err));
								} }
								slim
							>
								Re-enable this account
							</Button>
						) : (
							<Button
								onClick={ () => {
									setShowDisableDialog(true);
								} }
								slim
							>
								Disable this account
							</Button>
						)
					}
					{
						showDisableDialog ? (
							<ManagementAccountDisableDialog
								id={ info.id }
								reload={ reload }
								close={ () => {
									setShowDisableDialog(false);
								} }
							/>
						) : null
					}
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

function ManagementAccountDisableDialog({ id, reload, close }: {
	id: AccountId;
	reload: () => void;
	close: () => void;
}): ReactElement {
	const htmlId = useId();
	const connector = useDirectoryConnector();
	const [publicReason, setPublicReason] = useState('');
	const [internalReason, setInternalReason] = useState('');

	return (
		<ModalDialog>
			<h1>Disable account { id }</h1>
			<Column>
				<label htmlFor={ htmlId + ':public-reason' }>Public reason</label>
				<TextInput id={ htmlId + ':public-reason' } value={ publicReason } onChange={ setPublicReason } />
				<label htmlFor={ htmlId + ':internal-reason' }>Internal reason</label>
				<textarea
					id={ htmlId + ':internal-reason' }
					value={ internalReason }
					onChange={ (ev) => {
						setInternalReason(ev.target.value);
					} }
				/>
				<Row alignX='space-between'>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					<Button
						disabled={ !publicReason || !internalReason }
						onClick={ () => {
							ToastHandlePromise(
								connector.awaitResponse('manageAccountDisable', { id, disable: { publicReason, internalReason } }),
								{
									pending: 'Processing request...',
									success: 'Request processed',
									error: 'Error processing request',
								},
							)
								.then((result) => {
									if (result.result === 'ok') {
										toast('Account disabled', TOAST_OPTIONS_SUCCESS);
										reload();
										close();
									} else {
										toast('Failed to disable account: ' + result.result, TOAST_OPTIONS_ERROR);
									}
								})
								.catch((err) => GetLogger('ManagementAccountDisableDialog').error('Error disabling account:', err));
						} }
					>
						Disable account
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
