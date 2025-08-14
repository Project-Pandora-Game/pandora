import {
	GetLogger,
	SpaceId,
} from 'pandora-common';
import { ReactElement, useCallback, useState } from 'react';
import { Button } from '../../../components/common/button/button.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import {
	useDirectoryConnector,
} from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { PersistentToast } from '../../../persistentToast.ts';
import './spaceConfiguration.scss';

export function SpaceOwnershipRemoval({ buttonClassName, ...data }: { id: SpaceId; name: string; buttonClassName?: string; }): ReactElement | null {
	const [state, setState] = useState<boolean>(false);
	return (
		<>
			<Button className={ buttonClassName } onClick={ () => setState(true) }>Give up your space ownership</Button>
			{
				state ? (
					<SpaceOwnershipRemovalDialog { ...data } closeDialog={ () => setState(false) } />
				) : (
					null
				)
			}
		</>
	);
}

const OwnershipRemovalProgress = new PersistentToast();

function SpaceOwnershipRemovalDialog({ id, name, closeDialog }: { id: SpaceId; name: string; closeDialog: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const removeOwnership = useCallback(() => {
		(async () => {
			OwnershipRemovalProgress.show('progress', 'Removing ownership...');
			const result = await directoryConnector.awaitResponse('spaceOwnership', {
				action: 'abandon',
				space: id,
			});
			if (result.result === 'ok') {
				OwnershipRemovalProgress.show('success', 'Space ownership removed!');
				closeDialog();
			} else {
				OwnershipRemovalProgress.show('error', `Failed to remove space ownership:\n${result.result}`);
			}
		})()
			.catch((err) => {
				GetLogger('UpdateSpace').warning('Error during space ownership removal', err);
				OwnershipRemovalProgress.show('error', `Error during space ownership removal:\n${err instanceof Error ? err.message : String(err)}`);
			});
	}, [id, closeDialog, directoryConnector]);

	return (
		<ModalDialog priority={ 10 }>
			<p>
				<b>
					Are you sure that you no longer want ownership of this space?
				</b>
			</p>
			<p>
				Space name: { name }<br />
				Space id: { id }
			</p>
			<p>
				Removing yourself as an owner will turn you into an admin instead and free up a space slot in your account's space count limit.<br />
				Note that a space without any owner gets instantly deleted, kicking everyone currently inside it in the process.<br />
				You cannot affect other owners - only an owner can give up their own ownership of a space.
			</p>
			<Row padding='medium' alignX='space-between'>
				<Button onClick={ closeDialog }>Cancel</Button>
				<Button theme='danger' onClick={ removeOwnership }>Remove your ownership!</Button>
			</Row>
		</ModalDialog>
	);
}
