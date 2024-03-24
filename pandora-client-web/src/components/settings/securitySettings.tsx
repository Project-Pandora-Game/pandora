import React, { ReactElement, useEffect } from 'react';
import { AssertNever, FormatTimeInterval, PasswordSchema, IDirectoryAccountInfo, IClientDirectoryNormalResult } from 'pandora-common';
import { useForm } from 'react-hook-form';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { PrehashPassword } from '../../crypto/helpers';
import { Form, FormCreateStringValidator, FormField, FormFieldError } from '../common/form/form';
import { Button } from '../common/button/button';
import { useAsyncEvent } from '../../common/useEvent';
import { ModalDialog, useConfirmDialog } from '../dialog/dialog';
import { useObservable } from '../../observable';
import type { AuthToken } from '../../networking/directoryConnector';
import { useCurrentTime } from '../../common/useCurrentTime';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';
import { Column, Row } from '../common/container/container';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../persistentToast';

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

	useEffect(() => {
		if (connections == null) {
			load();
		}
	}, [connections, load]);

	return (
		<fieldset>
			<legend>Connected Clients</legend>
			<Column>
				<CurrentSessionInfo refresh={ load } processing={ processing } />
				<ConnectedClientsList connections={ connections } />
			</Column>
		</fieldset>
	);
}

function ConnectedClientsList({ connections }: { connections: AccountConnectedClients | null; }): ReactElement {
	if (connections === null)
		return <>Loading...</>;

	return (
		<table>
			<thead>
				<tr>
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
			<td>{ connectionCount }</td>
			<td>{ connectedCharacters.map(({ id, name }) => `${name} (${id})`).join(', ') }</td>
			<td>
				{
					isCurrent ? (
						'Current connection'
					) : (
						<Button className='slim' onClick={ disconnect }>Disconnect</Button>
					)
				}
			</td>
		</tr>
	);
}

function CurrentSessionInfo({ refresh, processing }: { refresh: () => void; processing: boolean; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const authToken = useObservable(directoryConnector.authToken);
	const confirm = useConfirmDialog();

	const logout = React.useCallback(() => {
		void confirm('Are you sure you want to logout?').then((confirmed) => {
			if (confirmed) {
				directoryConnector.sendMessage('logout', { type: 'self' });
			}
		});
	}, [confirm, directoryConnector]);

	const logoutAll = React.useCallback(() => {
		void confirm('Are you sure you want to logout from all clients?').then((confirmed) => {
			if (confirmed) {
				directoryConnector.sendMessage('logout', { type: 'all' });
			}
		});
	}, [confirm, directoryConnector]);

	if (!authToken)
		return <>Not logged in</>;

	return (
		<Column>
			<SessionExpire token={ authToken } />
			<Row alignX='center'>
				<ExtendCurrentSession token={ authToken } />
				<Button className='slim' onClick={ logout } title='Logout from current session'>Logout</Button>
				<Button className='slim' onClick={ logoutAll } title='Logout from all devices'>Logout all</Button>
				<Button className='slim' onClick={ refresh } disabled={ processing } title='Refresh connection info'>Refresh</Button>
			</Row>
		</Column>
	);
}

function ExtendCurrentSession({ token }: { token: AuthToken; }): ReactElement {
	const [show, setShow] = React.useState(false);

	const hide = React.useCallback(() => {
		setShow(false);
		return true;
	}, []);

	useKeyDownEvent(hide, 'Escape');

	if (!show)
		return <Button onClick={ () => setShow(true) } title='Extend current session'>Extend Session</Button>;

	return (
		<>
			<Button className='slim' onClick={ hide } title='Extend current session'>Extend Session</Button>
			<ExtendCurrentSessionDialog token={ token } hide={ hide } />
		</>
	);
}

function SessionExpire({ token }: { token: AuthToken; }): ReactElement {
	const now = useCurrentTime(60_000);

	return (
		<p>Your session will expire in { FormatTimeInterval(token.expires - now, 'two-most-significant') }</p>
	);
}

function ExtendCurrentSessionDialog({ token, hide }: { token: AuthToken; hide: () => boolean; }): ReactElement {
	const directory = useDirectoryConnector();
	const [password, setPassword] = React.useState('');

	const [extend, processing] = useAsyncEvent(
		async () => {
			const passwordSha512 = await PrehashPassword(password);
			return await directory.awaitResponse('extendLoginToken', { passwordSha512 });
		},
		({ result }) => {
			if (result === 'ok') {
				toast('Session extended', TOAST_OPTIONS_SUCCESS);
				hide();
			} else {
				toast('Invalid password', TOAST_OPTIONS_ERROR);
				setPassword('');
			}
		},
	);
	const onSubmit = React.useCallback((ev: React.FormEvent) => {
		ev.preventDefault();
		extend();
	}, [extend]);

	return (
		<ModalDialog>
			<Form dirty={ false } onSubmit={ onSubmit }>
				<SessionExpire token={ token } />
				<FormField>
					<label htmlFor='extend-current-session-password'>Password</label>
					<input
						type='password'
						id='extend-current-session-password'
						autoComplete='current-password'
						value={ password }
						onChange={ (e) => setPassword(e.target.value) }
					/>
				</FormField>
				<br />
				<Row>
					<Button onClick={ hide } disabled={ processing }>Cancel</Button>
					<Button type='submit' disabled={ processing }>Extend</Button>
				</Row>
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
				setInvalidPassword(oldPassword);
				break;
			default:
				AssertNever(resp.result);
		}
	});

	return (
		<fieldset>
			<legend>Password Change</legend>
			<Form dirty={ submitCount > 0 } onSubmit={ onSubmit }>
				<FormField>
					<label htmlFor='password-change-old'>Old password</label>
					<input
						type='password'
						id='password-change-old'
						autoComplete='current-password'
						{ ...register('oldPassword', {
							required: 'Old password is required',
							validate: (oldPassword) => (invalidPassword === oldPassword) ? 'Invalid password' : true,
						}) }
					/>
					<FormFieldError error={ errors.oldPassword } />
				</FormField>
				<FormField>
					<label htmlFor='password-change-new'>New password</label>
					<input
						type='password'
						id='password-change-new'
						autoComplete='new-password'
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
						autoComplete='new-password'
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
		</fieldset>
	);
}
