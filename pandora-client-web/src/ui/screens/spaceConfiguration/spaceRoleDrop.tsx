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

export function SpaceRoleDropButton({ buttonClassName, role, ...data }: { id: SpaceId; name: string; role: 'admin' | 'allowlisted'; buttonClassName?: string; }): ReactElement | null {
	const [state, setState] = useState<boolean>(false);
	return (
		<>
			<Button className={ buttonClassName } onClick={ () => setState(true) }>Give up your { role === 'admin' ? 'admin' : 'allowed user' } role</Button>
			{
				state ? (
					<SpaceRoleDropButtonDialog { ...data } role={ role } closeDialog={ () => setState(false) } />
				) : (
					null
				)
			}
		</>
	);
}

const Progress = new PersistentToast();

function SpaceRoleDropButtonDialog({ id, name, role, closeDialog }: { id: SpaceId; name: string; role: 'admin' | 'allowlisted'; closeDialog: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const execute = useCallback(() => {
		(async () => {
			Progress.show('progress', 'Removing role...');
			const result = await directoryConnector.awaitResponse('spaceDropRole', {
				space: id,
				role,
			});
			if (result.result === 'ok') {
				Progress.show('success', 'Role removed!');
				closeDialog();
			} else {
				Progress.show('error', `Failed to remove role:\n${result.result}`);
			}
		})()
			.catch((err) => {
				GetLogger('UpdateSpace').warning('Error during role removal', err);
				Progress.show('error', `Error during role removal:\n${err instanceof Error ? err.message : String(err)}`);
			});
	}, [id, role, closeDialog, directoryConnector]);

	return (
		<ModalDialog priority={ 10 }>
			<p>
				<b>
					Are you sure that you no longer want to be an { role === 'admin' ? 'admin' : 'allowed user' } of this space?
				</b>
			</p>
			<p>
				Space name: { name }<br />
				Space id: { id }
			</p>
			<p>
				Removing yourself from the role will remove you from the list. This might prevent you from entering the space or even seeing the space, if it is not public.<br />
				You can be re-added as an { role === 'admin' ? 'admin' : 'allowed user' } anytime you are inside the space or by an admin that has you as a contact.
			</p>
			<Row padding='medium' alignX='space-between'>
				<Button onClick={ closeDialog }>Cancel</Button>
				<Button theme='danger' onClick={ execute }>Give up your { role === 'admin' ? 'admin' : 'allowed user' } role</Button>
			</Row>
		</ModalDialog>
	);
}
