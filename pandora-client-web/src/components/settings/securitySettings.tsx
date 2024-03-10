import React, { ReactElement } from 'react';
import { AssertNever, PasswordSchema, IDirectoryAccountInfo, IClientDirectoryNormalResult } from 'pandora-common';
import { useForm } from 'react-hook-form';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { PrehashPassword } from '../../crypto/helpers';
import { Form, FormCreateStringValidator, FormField, FormFieldError } from '../common/form/form';
import { Button } from '../common/button/button';
import { FieldsetToggle } from '../common/fieldsetToggle/fieldsetToggle';
import { useAsyncEvent } from '../../common/useEvent';
import { useConfirmDialog } from '../dialog/dialog';

export function SecuritySettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ConnectedClients />
			<PasswordChange account={ account } />
		</>
	);
}

type AccountConnectedClients = IClientDirectoryNormalResult['queryConnections']['connections'];

function ConnectedClients(): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [connections, setConnections] = React.useState<AccountConnectedClients | null>(null);

	const [load, processing] = useAsyncEvent(
		async () => await directoryConnector.awaitResponse('queryConnections', {}),
		(resp) => setConnections(resp.connections),
	);

	const onChange = React.useCallback((open: boolean) => {
		if (open && connections === null) {
			void load();
		}
	}, [connections, load]);

	return (
		<FieldsetToggle legend='Connected Clients' open={ false } onChange={ onChange }>
			<div>
				<ConnectedClientsList connections={ connections } />
				<Button onClick={ load } disabled={ processing }>Refresh</Button>
			</div>
		</FieldsetToggle>
	);
}

function ConnectedClientsList({ connections }: { connections: AccountConnectedClients | null; }): ReactElement {
	if (connections === null)
		return <>Loading...</>;

	return (
		<table>
			<thead>
				<tr>
					<th>Id</th>
					<th>Characters</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{
					connections.map((c) => <ConnectedClientConnection key={ c.loginTokenId } connection={ c } />)
				}
			</tbody>
		</table>
	);
}

function ConnectedClientConnection({ connection }: { connection: AccountConnectedClients[number]; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const confirm = useConfirmDialog();

	const { loginTokenId, connectedCharacters } = connection;

	const disconnect = React.useCallback(() => {
		void confirm('Are you sure you want to disconnect this client?').then((confirmed) => {
			if (confirmed) {
				directoryConnector.sendMessage('logout', { type: 'selected', accountTokenId: loginTokenId });
			}
		});
	}, [confirm, directoryConnector, loginTokenId]);

	return (
		<tr>
			<td>{ loginTokenId }</td>
			<td>{ connectedCharacters.map(({ id, name }) => `${name} (${id})`).join(', ') }</td>
			<td>
				<Button className='slim' onClick={ disconnect }>Disconnect</Button>
			</td>
		</tr>
	);
}

interface PasswordChangeFormData {
	oldPassword: string;
	newPassword: string;
	newPasswordConfirm: string;
}

function PasswordChange({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [invalidPassword, setInvalidPassword] = React.useState('');

	const {
		formState: { errors, submitCount, isSubmitting },
		reset,
		getValues,
		handleSubmit,
		register,
		trigger,
	} = useForm<PasswordChangeFormData>({ shouldUseNativeValidation: true, progressive: true });

	React.useEffect(() => {
		if (invalidPassword) {
			void trigger();
		}
	}, [invalidPassword, trigger]);

	const onSubmit = handleSubmit(async ({ oldPassword, newPassword }) => {
		const passwordSha512Old = await PrehashPassword(oldPassword);
		const passwordSha512New = await PrehashPassword(newPassword);
		const { cryptoKey, onSuccess } = await directoryConnector.directMessageHandler.passwordChange(account.username, newPassword);

		const resp = await directoryConnector.awaitResponse('passwordChange', {
			passwordSha512Old,
			passwordSha512New,
			cryptoKey,
		});

		switch (resp.result) {
			case 'ok':
				onSuccess();
				reset();
				break;
			case 'invalidPassword':
				setInvalidPassword('Invalid password');
				break;
			default:
				AssertNever(resp.result);
		}
	});

	return (
		<FieldsetToggle legend='Password Change' open={ false }>
			<Form dirty={ submitCount > 0 } onSubmit={ onSubmit }>
				<FormField>
					<label htmlFor='password-change-old'>Old password</label>
					<input
						type='password'
						id='password-change-old'
						{ ...register('oldPassword', {
							required: 'Old password is required',
							validate: FormCreateStringValidator(PasswordSchema, 'password'),
						}) }
					/>
					<FormFieldError error={ errors.oldPassword } />
				</FormField>
				<FormField>
					<label htmlFor='password-change-new'>New password</label>
					<input
						type='password'
						id='password-change-new'
						{ ...register('newPassword', {
							required: 'New password is required',
							validate: FormCreateStringValidator(PasswordSchema, 'password'),
						}) }
					/>
					<FormFieldError error={ errors.newPassword } />
				</FormField>
				<FormField>
					<label htmlFor='password-change-new-confirm'>Confirm new password</label>
					<input
						type='password'
						id='password-change-new-confirm'
						{ ...register('newPasswordConfirm', {
							required: 'New password confirmation is required',
							validate: (newPasswordConfirm) => {
								const newPassword = getValues('newPassword');
								return (newPasswordConfirm === newPassword) || 'Passwords do not match';
							},
						}) }
					/>
					<FormFieldError error={ errors.newPasswordConfirm } />
				</FormField>
				<Button type='submit' disabled={ isSubmitting }>Change password</Button>
			</Form>
		</FieldsetToggle>
	);
}
