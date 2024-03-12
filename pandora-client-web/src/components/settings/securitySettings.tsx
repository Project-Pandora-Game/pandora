import React, { ReactElement } from 'react';
import { AssertNever, FormatTimeInterval, PasswordSchema, IDirectoryAccountInfo, IClientDirectoryNormalResult } from 'pandora-common';
import { useForm } from 'react-hook-form';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { PrehashPassword } from '../../crypto/helpers';
import { Form, FormCreateStringValidator, FormField, FormFieldError } from '../common/form/form';
import { Button } from '../common/button/button';
import { FieldsetToggle } from '../common/fieldsetToggle/fieldsetToggle';
import { useAsyncEvent } from '../../common/useEvent';
import { ModalDialog, useConfirmDialog } from '../dialog/dialog';
import { useObservable } from '../../observable';
import type { AuthToken } from '../../networking/directoryConnector';
import { useCurrentTime } from '../../common/useCurrentTime';

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
					<th>Connections</th>
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
	const authToken = useObservable(directoryConnector.authToken);
	const confirm = useConfirmDialog();

	const { loginTokenId, connectionCount, connectedCharacters } = connection;

	const disconnect = React.useCallback(() => {
		void confirm('Are you sure you want to disconnect this client?').then((confirmed) => {
			if (confirmed) {
				directoryConnector.sendMessage('logout', { type: 'selected', accountTokenId: loginTokenId });
			}
		});
	}, [confirm, directoryConnector, loginTokenId]);

	const isCurrent = authToken?.value.startsWith(loginTokenId);

	return (
		<tr className={ isCurrent ? 'current-connection' : undefined }>
			<td>{ loginTokenId }</td>
			<td>{ connectionCount }</td>
			<td>{ connectedCharacters.map(({ id, name }) => `${name} (${id})`).join(', ') }</td>
			<td>
				{
					isCurrent ? (
						<>
							<Button className='slim' onClick={ disconnect }>Logout</Button>
							<ExtendCurrentSession token={ authToken! } />
						</>
					) : (
						<Button className='slim' onClick={ disconnect }>Disconnect</Button>
					)
				}
			</td>
		</tr>
	);
}

function ExtendCurrentSession({ token }: { token: AuthToken; }): ReactElement {
	const [show, setShow] = React.useState(false);
	if (!show)
		return <Button className='slim' onClick={ () => setShow(true) }>Extend</Button>;

	return (
		<>
			<Button className='slim' onClick={ () => setShow(false) }>Extend</Button>
			<ExtendCurrentSessionDialog token={ token } />
		</>
	);
}

function ExtendCurrentSessionDialog({ token }: { token: AuthToken; }): ReactElement {
	const directory = useDirectoryConnector();
	const [password, setPassword] = React.useState('');
	const now = useCurrentTime(60_000);

	const [extend, processing] = useAsyncEvent(
		() => directory.extendAuthToken(password),
		() => setPassword(''),
	);

	return (
		<ModalDialog>
			<Form dirty={ false } onSubmit={ extend }>
				<p>Your session will expire in { FormatTimeInterval(token.expires - now, 'short') }</p>
				<FormField>
					<label htmlFor='extend-current-session-password'>Password</label>
					<input
						type='password'
						id='extend-current-session-password'
						value={ password }
						onChange={ (e) => setPassword(e.target.value) }
					/>
				</FormField>
				<Button type='submit' disabled={ processing }>Extend</Button>
			</Form>
		</ModalDialog>
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
