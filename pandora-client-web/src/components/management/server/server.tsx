import { capitalize } from 'lodash-es';
import { Assert, DirectoryStatusAnnouncementSchema, GetLogger, IsAuthorized, type DirectoryStatusAnnouncement } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { GetDirectoryUrl, useAuthTokenHeader, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';

export function ServerManagement(): ReactElement {
	return (
		<Announcement />
	);
}

function Announcement(): ReactElement {
	const account = useCurrentAccount();
	const auth = useAuthTokenHeader();
	const authorized = !!auth && account?.roles !== undefined && IsAuthorized(account.roles, 'lead-developer');

	const directoryStatus = useObservable(useDirectoryConnector().directoryStatus);

	const [type, setType] = useState<DirectoryStatusAnnouncement['type']>(directoryStatus.announcement?.type ?? 'info');
	const [title, setTitle] = useState(directoryStatus.announcement?.title ?? '');
	const [content, setContent] = useState(directoryStatus.announcement?.content ?? '');

	return (
		<FieldsetToggle legend='Announcement'>
			<Column>
				<Column gap='tiny'>
					<label>Type</label>
					<Select
						value={ type }
						onChange={ (ev) => {
							setType(DirectoryStatusAnnouncementSchema.shape.type.parse(ev.target.value));
						} }
						disabled={ !authorized }
					>
						{
							DirectoryStatusAnnouncementSchema.shape.type.options.map((o) => (
								<option key={ o } value={ o }>
									{ capitalize(o) }
								</option>
							))
						}
					</Select>
				</Column>
				<Column gap='tiny'>
					<label>Title</label>
					<TextInput
						value={ title }
						onChange={ setTitle }
						disabled={ !authorized }
					/>
				</Column>
				<Column gap='tiny'>
					<label>Content</label>
					<textarea
						value={ content }
						onChange={ (ev) => {
							setContent(ev.target.value);
						} }
						rows={ 6 }
						disabled={ !authorized }
					/>
				</Column>
				<Row alignX='space-evenly'>
					<Button
						disabled={ !authorized }
						onClick={ () => {
							Assert(!!auth);

							fetch(new URL(`pandora/mgmt/announcement`, GetDirectoryUrl()), {
								method: 'DELETE',
								headers: {
									Authorization: auth,
								},
								mode: 'cors',
							})
								.then((result) => {
									if (result.ok) {
										toast('Success', TOAST_OPTIONS_SUCCESS);
									} else {
										throw new Error(`Server returned error: ${result.status} ${result.statusText}`);
									}
								})
								.catch((err: unknown) => {
									GetLogger('Announcement').error('Error clearing announcement:', err);
									toast('Error clearing announcement:\n' + String(err), TOAST_OPTIONS_ERROR);
								});
						} }
					>
						Clear current announcement
					</Button>
					<Button
						onClick={ () => {
							Assert(!!auth);

							fetch(new URL(`pandora/mgmt/announcement`, GetDirectoryUrl()), {
								method: 'PUT',
								body: JSON.stringify({
									type,
									title: title.trim(),
									content: content.trim(),
								} satisfies DirectoryStatusAnnouncement),
								headers: {
									'Authorization': auth,
									'Content-Type': 'application/json',
								},
								mode: 'cors',
							})
								.then((result) => {
									if (result.ok) {
										toast('Success', TOAST_OPTIONS_SUCCESS);
									} else {
										throw new Error(`Server returned error: ${result.status} ${result.statusText}`);
									}
								})
								.catch((err: unknown) => {
									GetLogger('Announcement').error('Error posting announcement:', err);
									toast('Error posting announcement:\n' + String(err), TOAST_OPTIONS_ERROR);
								});
						} }
						disabled={ !authorized || !title.trim() }
					>
						Post announcement
					</Button>
				</Row>
			</Column>
		</FieldsetToggle>
	);
}
