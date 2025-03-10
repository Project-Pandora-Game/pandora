import { noop, startCase } from 'lodash-es';
import { AccountId, AccountPublicInfo, AccountRoleSchema, AssertNever, GetLogger, IClientDirectoryNormalResult, LIMIT_ACCOUNT_PROFILE_LENGTH } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { ProfileDescription } from './profileDescription.tsx';

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
	const isPlayer = useCurrentAccount()?.id === accountData.id;

	return (
		<Column className='profileView flex-1' gap='none' overflowY='auto'>
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
			</span>
			<Scrollable className='flex-1'>
				<Column className='profileContent' padding='medium'>
					<span>
						Titles:&nbsp;
						{
							accountData.visibleRoles.length > 0 ? (
								AccountRoleSchema.options
									.filter((role) => accountData.visibleRoles.includes(role))
									.map((role) => startCase(role))
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
						{
							isPlayer ? (
								<Link to='/settings/account' className='center-flex'>
									<div className='labelColorMark' style={ { backgroundColor: accountData.labelColor } } />
								</Link>
							) : (
								<div className='labelColorMark' style={ { backgroundColor: accountData.labelColor } } />
							)
						}
						<span className='selectable'>{ accountData.labelColor.toUpperCase() }</span>
					</Row>
					<AccountProfileDescription profileDescription={ accountData.profileDescription } allowEdit={ isPlayer } />
				</Column>
			</Scrollable>
		</Column>
	);
}

function AccountProfileDescription({ profileDescription, allowEdit }: { profileDescription: string; allowEdit: boolean; }): ReactElement {
	const [editMode, setEditMode] = useState(false);
	const [editedDescription, setEditedDescription] = useState(profileDescription);
	const directoryConnector = useDirectoryConnector();

	if (editMode && allowEdit) {
		return (
			<Column className='flex-1'>
				<Row alignX='space-between' alignY='end'>
					<span>Editing the profile description ({ editedDescription.trim().length } / { LIMIT_ACCOUNT_PROFILE_LENGTH }):</span>
					<Button
						slim
						onClick={ () => {
							if (editedDescription.trim().length > LIMIT_ACCOUNT_PROFILE_LENGTH) {
								toast(`The description is too long`, TOAST_OPTIONS_WARNING);
								return;
							}

							directoryConnector.awaitResponse('updateProfileDescription', { profileDescription: editedDescription.trim() })
								.then((result) => {
									if (result.result === 'ok') {
										setEditMode(false);
										return;
									}
									AssertNever(result.result);
								})
								.catch((err) => {
									GetLogger('AccountProfileDescription').error('Error saving description:', err);
									toast(`Error saving description`, TOAST_OPTIONS_ERROR);
								});
						} }
					>
						Save
					</Button>
				</Row>
				<textarea
					className='flex-1 profileDescriptionContent profileEdit'
					style={ { resize: 'none' } }
					value={ editedDescription }
					onChange={ (ev) => {
						setEditedDescription(ev.target.value);
					} }
				/>
			</Column>
		);
	}

	return (
		<Column className='flex-1'>
			<Row alignX='space-between' alignY='end'>
				<span>Profile description:</span>
				{
					allowEdit ? (
						<Button slim onClick={ () => setEditMode(true) }>
							Edit
						</Button>
					) : <span />
				}
			</Row>
			<div className='flex-1 profileDescriptionContent'>
				<ProfileDescription contents={ editedDescription.trim() } />
			</div>
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
