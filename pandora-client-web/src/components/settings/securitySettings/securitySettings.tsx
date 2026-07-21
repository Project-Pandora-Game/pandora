import { AssertNever, GetLogger, LIMIT_ACCOUNT_PASSKEY_COUNT, LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH, PasswordSchema } from 'pandora-common';
import type { IClientDirectoryNormalResult, IDirectoryAccountInfo } from 'pandora-common/networking/api/directory_client';
import React, { ReactElement, useCallback, useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { useKeyDownEvent } from '../../../common/useKeyDownEvent.ts';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { DEVELOPMENT } from '../../../config/Environment.ts';
import { PrehashPassword } from '../../../crypto/helpers.ts';
import { CreatePasskeyCredential, IsPasskeySupported } from '../../../crypto/passkey.ts';
import type { AuthToken } from '../../../networking/directoryConnector.ts';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useService } from '../../../services/serviceProvider.tsx';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { Form, FormCreateStringValidator, FormField, FormFieldError } from '../../common/form/form.tsx';
import { useConfirmDialog } from '../../dialog/dialog.tsx';
import { useAuthToken, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { ExtendCurrentSessionDialog, SessionExpireInfo } from './extendSession.tsx';
import { SudoModeButton, useSudoMode } from './sudoMode.tsx';

export function SecuritySettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ConnectedClients />
			<PasskeySettings />
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
			<legend>Connected clients</legend>
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

type AccountPasskeys = IClientDirectoryNormalResult['passkeyList']['passkeys'];

function PasskeySettings(): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const directMessageManager = useService('directMessageManager');
	const { sudoActive, clearSudoMode } = useSudoMode();
	const [passkeys, setPasskeys] = React.useState<AccountPasskeys | null>(null);
	const passkeySupported = IsPasskeySupported();
	const defaultPasskeyName = 'Security key';

	const [load, loading] = useAsyncEvent(
		async () => await directoryConnector.awaitResponse('passkeyList', {}),
		(resp) => {
			setPasskeys(resp.passkeys);
		},
	);

	const [add, adding] = useAsyncEvent(async () => {
		const start = await directoryConnector.awaitResponse('passkeyRegisterStart', {});
		if (start.result !== 'ok')
			return start.result;

		const credential = await CreatePasskeyCredential(start);
		const cryptoKey = await directMessageManager.exportPasskeyWrappedKey(credential.wrappingSecret);
		const finish = await directoryConnector.awaitResponse('passkeyRegisterFinish', {
			name: defaultPasskeyName,
			credentialId: credential.credentialId,
			publicKeyAlgorithm: credential.publicKeyAlgorithm,
			publicKey: credential.publicKey,
			clientDataJSON: credential.clientDataJSON,
			attestationObject: credential.attestationObject,
			authenticatorData: credential.authenticatorData,
			transports: credential.transports,
			cryptoKey,
		});
		return finish.result;
	}, (result) => {
		switch (result) {
			case 'ok':
				toast('Passkey added', TOAST_OPTIONS_SUCCESS);
				load();
				break;
			case 'sudoRequired':
				clearSudoMode();
				toast('Please confirm your identity again.', TOAST_OPTIONS_ERROR);
				break;
			case 'limitReached':
				toast('Passkey limit reached', TOAST_OPTIONS_ERROR);
				break;
			case 'alreadyExists':
				toast('This passkey is already registered', TOAST_OPTIONS_ERROR);
				break;
			case 'invalidCryptoKey':
				toast('Passkey could not be linked to the current direct message key', TOAST_OPTIONS_ERROR);
				break;
			default:
				toast('Failed to add passkey', TOAST_OPTIONS_ERROR);
				break;
		}
	}, {
		errorHandler: (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			toast(`Failed to add passkey:\n${detail}`, TOAST_OPTIONS_ERROR);
		},
	});

	useEffect(() => {
		if (passkeys == null) {
			load();
		}
	}, [load, passkeys]);

	return (
		<fieldset>
			<legend>Passkeys</legend>
			<Column>
				{ passkeys != null ? (
						<Column alignX='end'><span>{ passkeys.length }/{ LIMIT_ACCOUNT_PASSKEY_COUNT } passkeys registered</span></Column>
					) : null }
				<PasskeyList passkeys={ passkeys } reload={ load } sudoActive={ sudoActive } clearSudoMode={ clearSudoMode } />
				{ sudoActive ? (
						<Button onClick={ add } disabled={ !passkeySupported || loading || adding || (passkeys?.length ?? 0) >= LIMIT_ACCOUNT_PASSKEY_COUNT }>
							Add passkey
						</Button>
				) : (
					<SudoModeButton disabled={ !passkeySupported || loading }>
						Manage passkeys
					</SudoModeButton>
				) }
			</Column>
		</fieldset>
	);
}

function PasskeyList({ passkeys, reload, sudoActive, clearSudoMode }: { passkeys: AccountPasskeys | null; reload: () => void; sudoActive: boolean; clearSudoMode: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const confirm = useConfirmDialog();

	if (passkeys == null)
		return <span>Loading…</span>;

	return (
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Created</th>
					<th>Last used</th>
					{ sudoActive ? (
						<th>Actions</th>
					) : null }
				</tr>
			</thead>
			<tbody>
				{
					passkeys.map((passkey) => (
						<PasskeyRow
							key={ passkey.credentialId }
							passkey={ passkey }
							reload={ reload }
							confirm={ confirm }
							directoryConnector={ directoryConnector }
							sudoActive={ sudoActive }
							clearSudoMode={ clearSudoMode }
						/>
					))
				}
			</tbody>
		</table>
	);
}

function PasskeyRow({
	passkey,
	reload,
	confirm,
	directoryConnector,
	sudoActive,
	clearSudoMode,
}: {
	passkey: AccountPasskeys[number];
	reload: () => void;
	confirm: ReturnType<typeof useConfirmDialog>;
	directoryConnector: ReturnType<typeof useDirectoryConnector>;
	sudoActive: boolean;
	clearSudoMode: () => void;
}): ReactElement {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(passkey.name);
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		if (!editing) {
			setName(passkey.name);
		}
	}, [editing, passkey.name]);

	const save = () => {
		const nextName = name.trim();
		if (nextName.length === 0 || nextName.length > LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH) {
			toast(`Passkey name must be 1-${LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH} characters`, TOAST_OPTIONS_ERROR);
			return;
		}

		setProcessing(true);
		directoryConnector.awaitResponse('passkeyRename', {
			credentialId: passkey.credentialId,
			name: nextName,
		})
			.then(({ result }) => {
				if (result === 'ok') {
					toast('Passkey renamed', TOAST_OPTIONS_SUCCESS);
					setEditing(false);
					reload();
				} else if (result === 'sudoRequired') {
					clearSudoMode();
					toast('Please confirm your identity again.', TOAST_OPTIONS_ERROR);
				} else {
					toast('Passkey not found', TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('PasskeyRow').error('Error updating passkey:', err);
				toast('Error updating passkey', TOAST_OPTIONS_ERROR);
			})
			.finally(() => {
				setProcessing(false);
			});
	};

	const remove = () => {
		confirm(`Delete passkey "${passkey.name}"?`)
			.then(async (confirmed) => {
				if (!confirmed)
					return;
				const { result } = await directoryConnector.awaitResponse('passkeyDelete', { credentialId: passkey.credentialId });
				if (result === 'ok') {
					toast('Passkey deleted', TOAST_OPTIONS_SUCCESS);
					reload();
				} else if (result === 'sudoRequired') {
					clearSudoMode();
					toast('Please confirm your identity again.', TOAST_OPTIONS_ERROR);
				} else {
					toast('Passkey not found', TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('PasskeyRow').error('Error deleting passkey:', err);
				toast('Error deleting passkey', TOAST_OPTIONS_ERROR);
			});
	};

	return (
		<tr>
			<td>
				{ editing ? (
					<TextInput value={ name } onChange={ setName } maxLength={ LIMIT_ACCOUNT_PASSKEY_NAME_LENGTH } disabled={ processing } />
				) : (
					passkey.name
				) }
			</td>
			<td>{ new Date(passkey.created).toLocaleString() }</td>
			<td>{ passkey.lastUsed == null ? 'Never' : new Date(passkey.lastUsed).toLocaleString() }</td>
			{ sudoActive ? (
				<td>
					{ editing ? (
						<Row alignX='center' className='fill-x'>
							<Button className='slim' onClick={ save } disabled={ processing || name.trim() === passkey.name }>
								Save
							</Button>
							<Button className='slim' onClick={ () => setEditing(false) } disabled={ processing }>
								Cancel
							</Button>
						</Row>
					) : (
						<Row alignX='center' className='fill-x'>
							<Button className='slim' onClick={ () => setEditing(true) }>
								Rename
							</Button>
							<Button className='slim' onClick={ remove }>
								Delete
							</Button>
						</Row>
					) }
				</td>
			) : null }
		</tr>
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
			<SessionExpireInfo token={ authToken } />
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

	const hide = useCallback(() => {
		setShow(false);
		return true;
	}, []);

	useKeyDownEvent(hide, 'Escape');

	return (
		<>
			<Button
				onClick={ () => {
					setShow((v) => !v);
				} }
				title='Extend current session'
			>
				Extend Session
			</Button>
			{ show ? (
				<ExtendCurrentSessionDialog token={ token } hide={ hide } />
			) : null }
		</>
	);
}

interface PasswordChangeFormData {
	newPassword: string;
	newPasswordConfirm: string;
}

function PasswordChange({ account }: { account: IDirectoryAccountInfo; }): ReactElement | null {
	const id = useId();
	const directoryConnector = useDirectoryConnector();
	const auth = useAuthToken();
	const directMessageManager = useService('directMessageManager');
	const { sudoActive, clearSudoMode } = useSudoMode();

	const {
		formState: { errors, submitCount, isSubmitting },
		reset,
		getValues,
		handleSubmit,
		register,
	} = useForm<PasswordChangeFormData>({ shouldUseNativeValidation: true, progressive: true });

	const onSubmit = handleSubmit(async ({ newPassword }) => {
		const passwordSha512New = await PrehashPassword(newPassword);
		const { cryptoKey, onSuccess } = await directMessageManager.passwordChange(account.username, newPassword);

		const resp = await directoryConnector.awaitResponse('passwordChange', {
			passwordSha512New,
			cryptoKey,
		});

		switch (resp.result) {
			case 'ok':
				onSuccess();
				reset();
				break;
			case 'sudoRequired':
				clearSudoMode();
				toast('Please confirm your identity again.', TOAST_OPTIONS_ERROR);
				break;
			case 'invalidCryptoKey':
				toast('Failed to change password: invalid encryption key', TOAST_OPTIONS_ERROR);
				break;
			default:
				AssertNever(resp.result);
		}
	});

	if (!auth)
		return null;

	return (
		<fieldset>
			<legend>Password change</legend>
			{
				sudoActive ? (
					<Form dirty={ submitCount > 0 } onSubmit={ onSubmit }>
						<Column>
							<FormField>
								<label htmlFor={ `${id}-username` }>Username</label>
								<TextInput
									id={ `${id}-username` }
									autoComplete='username'
									readOnly
									value={ auth.username }
								/>
								<FormFieldError error={ undefined } />
							</FormField>
							<FormField>
								<label htmlFor={ `${id}-new` }>New password</label>
								<FormInput
									type='password'
									id={ `${id}-new` }
									autoComplete='new-password'
									register={ register }
									name='newPassword'
									options={ {
										required: 'New password is required',
										validate: DEVELOPMENT ? undefined : FormCreateStringValidator(PasswordSchema, 'password'),
									} }
								/>
								{ DEVELOPMENT ? (
									<em>Running in development mode.<br />Password restrictions are disabled.</em>
								) : null }
								<FormFieldError error={ errors.newPassword } />
							</FormField>
							<FormField>
								<label htmlFor={ `${id}-new-confirm` }>Confirm new password</label>
								<FormInput
									type='password'
									id={ `${id}-new-confirm` }
									autoComplete='new-password'
									register={ register }
									name='newPasswordConfirm'
									options={ {
										required: 'New password confirmation is required',
										validate: (newPasswordConfirm) => {
											const newPassword = getValues('newPassword');
											return (newPasswordConfirm === newPassword) || 'Passwords do not match';
										},
									} }
								/>
								<FormFieldError error={ errors.newPasswordConfirm } />
							</FormField>
						</Column>
						<Button type='submit' disabled={ isSubmitting }>Change password</Button>
					</Form>
				) : (
					<Column>
						<SudoModeButton>
							Start password change
						</SudoModeButton>
					</Column>
				)
			}
		</fieldset>
	);
}
