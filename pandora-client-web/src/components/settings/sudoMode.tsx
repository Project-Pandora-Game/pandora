import { GetLogger } from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { PrehashPassword } from '../../crypto/helpers.ts';
import { GetPasskeyAssertion, IsPasskeyConditionalMediationSupported, IsPasskeySupported } from '../../crypto/passkey.ts';
import { Observable, useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../persistentToast.ts';
import { Button, ButtonTheme } from '../common/button/button.tsx';
import { Column } from '../common/container/container.tsx';
import { Form, FormField } from '../common/form/form.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useAuthToken, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import './sudoMode.scss';

const SudoExpires = new Observable(0);

function ClearSudoMode(): void {
	SudoExpires.value = 0;
}

export function useSudoMode(): {
	sudoActive: boolean;
	sudoExpires: number;
	clearSudoMode: () => void;
} {
	const expires = useObservable(SudoExpires);
	const now = useCurrentTime(1000);

	return {
		sudoActive: expires > now,
		sudoExpires: expires,
		clearSudoMode: ClearSudoMode,
	};
}

export function SudoModeButton({
	children = 'Continue',
	disabled = false,
	theme = 'default',
}: {
	children?: ReactNode;
	disabled?: boolean;
	theme?: ButtonTheme;
}): ReactElement {
	const [showPrompt, setShowPrompt] = React.useState(false);

	return (
		<>
			<Button theme={ theme } disabled={ disabled } onClick={ () => setShowPrompt(true) }>
				{ children }
			</Button>
			{ showPrompt ? (
				<SudoDialog
					hide={ () => {
						setShowPrompt(false);
					} }
				/>
			) : null }
		</>
	);
}

export function SudoDialog({ hide }: {
	hide: () => void;
}): ReactElement | null {
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

	const confirmIdentity = useCallback((expires: number) => {
		SudoExpires.value = expires;
		setPassword('');
		hide();
		toast('Access confirmed', TOAST_OPTIONS_SUCCESS);
	}, [hide]);

	const [authenticateWithPassword, passwordProcessing] = useAsyncEvent(async (ev: React.SubmitEvent) => {
		ev.preventDefault();

		return await directoryConnector.awaitResponse('sudoAuthenticate', {
			passwordSha512: await PrehashPassword(password),
		});
	}, (response) => {
		switch (response.result) {
			case 'ok':
				confirmIdentity(response.expires);
				break;
			case 'invalidPassword':
				setPassword('');
				toast('Invalid password', TOAST_OPTIONS_ERROR);
				break;
		}
	}, {
		errorHandler: (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			toast(`Failed to confirm identity:\n${detail}`, TOAST_OPTIONS_ERROR);
		},
	});

	const [authenticateWithPasskey, passkeyProcessing] = useAsyncEvent(async () => {
		conditionalPasskeyAbort.current?.abort();

		const start = await directoryConnector.awaitResponse('sudoPasskeyStart', {});
		if (start.result !== 'ok')
			return start;

		const assertion = await GetPasskeyAssertion(start);
		return await directoryConnector.awaitResponse('sudoPasskeyFinish', {
			credentialId: assertion.credentialId,
			clientDataJSON: assertion.clientDataJSON,
			authenticatorData: assertion.authenticatorData,
			signature: assertion.signature,
		});
	}, (response) => {
		switch (response.result) {
			case 'ok':
				confirmIdentity(response.expires);
				break;
			case 'noPasskey':
				toast('No passkey is registered on this account', TOAST_OPTIONS_ERROR);
				break;
			case 'unknownCredential':
				toast('Passkey confirmation failed', TOAST_OPTIONS_ERROR);
				break;
		}
	}, {
		errorHandler: (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			toast(`Failed to confirm identity:\n${detail}`, TOAST_OPTIONS_ERROR);
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
			const start = await directoryConnector.awaitResponse('sudoPasskeyStart', {});
			if (start.result !== 'ok' || start.credentials.length === 0 || signal.aborted)
				return;

			const assertion = await GetPasskeyAssertion(start, { mediation: 'conditional', signal });
			const response = await directoryConnector.awaitResponse('sudoPasskeyFinish', {
				credentialId: assertion.credentialId,
				clientDataJSON: assertion.clientDataJSON,
				authenticatorData: assertion.authenticatorData,
				signature: assertion.signature,
			});
			switch (response.result) {
				case 'ok':
					confirmIdentity(response.expires);
					break;
				case 'unknownCredential':
					toast('Passkey confirmation failed', TOAST_OPTIONS_ERROR);
					break;
			}
		})()
			.catch((error) => {
				if (signal.aborted || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')))
					return;

				GetLogger('SudoDialog').warning('Conditional passkey confirm failed:', error);
			});

		return () => {
			abortController.abort();
			if (conditionalPasskeyAbort.current === abortController) {
				conditionalPasskeyAbort.current = null;
			}
		};
	}, [authValid, confirmIdentity, directoryConnector, passkeySupport.conditional]);

	if (!auth) {
		return null;
	}

	return (
		<ModalDialog priority={ 10 } className='SudoDialog'>
			<Form dirty={ false } onSubmit={ authenticateWithPassword }>
				<Column gap='large'>
					<h1 className='title'>Confirm access</h1>
					<i className='footer-tip'>
						You need to re-authenticate before performing this action.
						After you confirm your identity, you will only be asked to do so again after a few minutes have passed.
					</i>
					<Column>
						<FormField>
							<label htmlFor={ `${id}-username` }>Username</label>
							<TextInput
								id={ `${id}-username` }
								autoComplete='username'
								readOnly
								value={ auth.username }
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
						<Button type='submit' disabled={ processing || password.length === 0 }>
							Confirm
						</Button>
						{ passkeySupport.supported ? (
							<>
								<hr className='fill-x' />
								<Button
									type='button'
									theme='semiTransparent'
									disabled={ processing }
									onClick={ authenticateWithPasskey }
								>
									Confirm with passkey
								</Button>
							</>
						) : null }
					</Column>
					<hr className='fill-x' />
					<Button onClick={ hide } disabled={ processing }>
						Cancel
					</Button>
				</Column>
			</Form>
		</ModalDialog>
	);
}
