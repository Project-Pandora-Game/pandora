import { GetLogger, type AccountId, type SpaceId } from 'pandora-common';
import { useCallback, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { AccountInputQuickSelectDialog } from '../../components/accountListInput/accountListInputSelectionDialog.tsx';

const OwnershipInvitationProgress = new PersistentToast();

export function SpaceOwnershipInvitation({ buttonClassName, id, name }: { id: SpaceId; name: string; buttonClassName?: string; }): ReactElement | null {
	const directoryConnector = useDirectoryConnector();

	const [state, setState] = useState(false);
	const [confirmed, setConfirmed] = useState(false);

	const addOwner = useCallback(async (account: AccountId) => {
		OwnershipInvitationProgress.show('progress', 'Processing...');
		const result = await directoryConnector.awaitResponse('spaceOwnership', {
			action: 'invite',
			space: id,
			target: account,
		});
		if (result.result === 'ok') {
			OwnershipInvitationProgress.show('success', 'Successfully invited user as an owner!');
			setState(false);
		} else {
			const reason = result.result === 'failed' ? 'Action failed, try again later.' :
				result.result === 'targetNotAdmin' ? 'Target needs to be an admin of the space first.' :
				result.result === 'targetNotAllowed' ? 'Target needs to be present in the space or in your contacts.' :
				`Unexpected error '${result.result}'`;

			OwnershipInvitationProgress.show('error', `Failed to invite user as an owner:\n${reason}`);
		}
	}, [id, setState, directoryConnector]);

	return (
		<>
			<Button className={ buttonClassName } onClick={ () => setState(true) }>Add another owner</Button>
			{
				state ? (
					confirmed ? (
						<AccountInputQuickSelectDialog
							close={ () => {
								setState(false);
							} }
							onSelect={ addOwner }
						/>
					) : (
						<ModalDialog priority={ 10 }>
							<p>
								Space name: { name }<br />
								Space id: { id }
							</p>
							<p>
								Adding another owner to a space will make them a permanent admin of the space and will allow you to disown the space without the space being deleted.<br />
								Note that you cannot affect other owners - only they will be able to give up their ownership of this space.
							</p>
							<p>
								In order to add a new owner, they already need to be an admin of the space and they need to be either present or in your contacts.<br />
								Attempting to add a new owner will create an invitation they will have to accept on this screen, as after becoming an owner, this space will occupy a space slot in their account.
							</p>
							<Row padding='medium' alignX='space-between'>
								<Button onClick={ () => {
									setState(false);
								} }>
									Cancel
								</Button>
								<Button onClick={ () => {
									setConfirmed(true);
								} }>
									Continue
								</Button>
							</Row>
						</ModalDialog>
					)
				) : (
					null
				)
			}
		</>
	);
}

export function SpaceOwnershipInvitationConfirm({ spaceId }: {
	spaceId: SpaceId;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const [execute, processing] = useAsyncEvent(async (action: 'inviteAccept' | 'inviteRefuse') => {
		OwnershipInvitationProgress.show('progress', 'Processing...');
		const result = await directoryConnector.awaitResponse('spaceOwnership', {
			action,
			space: spaceId,
		});
		if (result.result === 'ok') {
			OwnershipInvitationProgress.show('success', `Successfully ${ action === 'inviteAccept' ? 'accepted' : 'refused' } ownership`);
		} else {
			const reason = result.result === 'failed' ? 'Action failed, try again later.' :
				result.result === 'spaceOwnershipLimitReached' ? 'You cannot own more spaces. Disown another space first to be able to accept ownership of this space.' :
				`Unexpected error '${result.result}'`;

			OwnershipInvitationProgress.show('error', `Error processing request:\n${reason}`);
		}
	}, null, {
		errorHandler: (err) => {
			GetLogger('SpaceOwnershipInvitationConfirm').error('Error processing action:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<Column gap='none'>
			<p>
				You have been invited as an owner to this space.<br />
				If you accept, you will become a permanent owner of this space and this space will use a slot from the spaces you can own.
			</p>
			<Row alignX='space-between' padding='medium'>
				<Button
					onClick={ (ev) => {
						ev.stopPropagation();
						execute('inviteRefuse');
					} }
					disabled={ processing }
				>
					Refuse invitation
				</Button>
				<Button
					onClick={ (ev) => {
						ev.stopPropagation();
						execute('inviteAccept');
					} }
					disabled={ processing }
				>
					Accept ownership
				</Button>
			</Row>
		</Column>
	);
}
