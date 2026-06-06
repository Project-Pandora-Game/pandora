import { AssertNever, FormatTimeInterval, GetLogger } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { PrehashPassword } from '../../../crypto/helpers.ts';
import { GetPasskeyAssertion, IsPasskeyConditionalMediationSupported, IsPasskeySupported } from '../../../crypto/passkey.ts';
import type { AuthToken } from '../../../networking/directoryConnector.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { Button } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
import { Form, FormField } from '../../common/form/form.tsx';
import { ModalDialog } from '../../dialog/dialog.tsx';
import { useAuthToken, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';

export function SessionExpireInfo({ token }: { token: AuthToken; }): ReactElement {
	const now = useCurrentTime();

	return (
		<Column alignX='center'>
			<span>Your session will expire in:</span>
			{ FormatTimeInterval(token.expires - now, 'two-most-significant') }
		</Column>
	);
}

export function ExtendCurrentSessionDialog({ token, hide }: { token: AuthToken; hide: () => boolean; }): ReactElement | null {
	const id = useId();
	const auth = useAuthToken();
	const directoryConnector = useDirectoryConnector();
	const authValid = auth != null && auth.expires >= Date.now();

	const [password, setPassword] = useState('');
	const [passkeySupport, setPasskeySupport] = useState({
		supported: false,
		conditional: false,
	});
	const conditionalPasskeyAbort = useRef<AbortController | null>(null);

	const onSuccess = useCallback(() => {
		toast('Session extended', TOAST_OPTIONS_SUCCESS);
		hide();
	}, [hide]);

	const [extendWithPassword, passwordProcessing] = useAsyncEvent(
		async (ev: SubmitEvent) => {
			ev.preventDefault();
			const passwordSha512 = await PrehashPassword(password);
			return await directoryConnector.awaitResponse('extendLoginToken', { passwordSha512 });
		},
		({ result }) => {
			if (result === 'ok') {
				onSuccess();
			} else {
				toast('Invalid password', TOAST_OPTIONS_ERROR);
				setPassword('');
			}
		},
	);

	const [extendWithPasskey, passkeyProcessing] = useAsyncEvent(async () => {
		conditionalPasskeyAbort.current?.abort();

		const start = await directoryConnector.awaitResponse('extendLoginPasskeyStart', {});
		if (start.result !== 'ok')
			return start;

		const assertion = await GetPasskeyAssertion(start);
		return await directoryConnector.awaitResponse('extendLoginPasskeyFinish', {
			credentialId: assertion.credentialId,
			clientDataJSON: assertion.clientDataJSON,
			authenticatorData: assertion.authenticatorData,
			signature: assertion.signature,
		});
	}, (response) => {
		switch (response.result) {
			case 'ok':
				onSuccess();
				break;
			case 'noPasskey':
				toast('No passkey is registered on this account', TOAST_OPTIONS_ERROR);
				break;
			case 'unknownCredential':
				toast('Passkey confirmation failed', TOAST_OPTIONS_ERROR);
				break;
			default:
				AssertNever(response);
		}
	}, {
		errorHandler: (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			toast(`Failed to extend session:\n${detail}`, TOAST_OPTIONS_ERROR);
		},
	});

	const processing = passwordProcessing || passkeyProcessing;

	useEffect(() => {
		const supported = IsPasskeySupported();
		setPasskeySupport({ supported, conditional: false });
		if (!supported)
			return;

		let active = true;
		IsPasskeyConditionalMediationSupported()
			.then((conditional) => {
				if (active) {
					setPasskeySupport({ supported, conditional });
				}
			}, () => {
				if (active) {
					setPasskeySupport({ supported, conditional: false });
				}
			});

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!passkeySupport.conditional || !authValid)
			return;

		const abortController = new AbortController();
		const signal = abortController.signal;
		conditionalPasskeyAbort.current = abortController;

		(async () => {
			const start = await directoryConnector.awaitResponse('extendLoginPasskeyStart', {});
			if (start.result !== 'ok' || start.credentials.length === 0 || signal.aborted)
				return;

			const assertion = await GetPasskeyAssertion(start, { mediation: 'conditional', signal });
			const response = await directoryConnector.awaitResponse('extendLoginPasskeyFinish', {
				credentialId: assertion.credentialId,
				clientDataJSON: assertion.clientDataJSON,
				authenticatorData: assertion.authenticatorData,
				signature: assertion.signature,
			});
			switch (response.result) {
				case 'ok':
					onSuccess();
					break;
				case 'unknownCredential':
					toast('Passkey confirmation failed', TOAST_OPTIONS_ERROR);
					break;
			}
		})()
			.catch((error) => {
				if (signal.aborted || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')))
					return;

				GetLogger('ExtendCurrentSessionDialog').warning('Conditional passkey confirm failed:', error);
			});

		return () => {
			abortController.abort();
			if (conditionalPasskeyAbort.current === abortController) {
				conditionalPasskeyAbort.current = null;
			}
		};
	}, [authValid, onSuccess, directoryConnector, passkeySupport.conditional]);

	if (!auth) {
		return null;
	}

	return (
		<ModalDialog>
			<Form dirty={ false } onSubmit={ extendWithPassword }>
				<Column gap='x-large'>
					<Column gap='medium'>
						<SessionExpireInfo token={ token } />
						<FormField>
							<label htmlFor={ `${id}-username` }>Username</label>
							<TextInput
								id={ `${id}-username` }
								autoComplete='username'
								value={ token.username }
								readOnly
							/>
						</FormField>
						<FormField>
							<label htmlFor={ `${id}-password` }>Password</label>
							<TextInput
								password
								id={ `${id}-password` }
								autoComplete='current-password webauthn'
								autoFocus
								value={ password }
								onChange={ setPassword }
								disabled={ processing }
							/>
						</FormField>
					</Column>
					<Column>
						<Button type='submit' disabled={ processing }>
							Extend
						</Button>
						{ passkeySupport.supported ? (
							<>
								<hr className='fill-x' />
								<Button
									type='button'
									theme='semiTransparent'
									disabled={ processing }
									onClick={ extendWithPasskey }
								>
									Extend with passkey
								</Button>
							</>
						) : null }
					</Column>
					<hr className='fill-x' />
					<Button
						onClick={ () => {
							hide();
						} }
						disabled={ processing }
					>
						Cancel
					</Button>
				</Column>
			</Form>
		</ModalDialog>
	);
}
