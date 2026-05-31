import React, { ReactElement, ReactNode, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { PrehashPassword } from '../../crypto/helpers.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../persistentToast.ts';
import { Button, ButtonTheme } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { Form, FormField } from '../common/form/form.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';

let sudoExpires = 0;
const sudoListeners = new Set<() => void>();

function GetSudoSnapshot(): number {
	return sudoExpires;
}

function SubscribeSudo(listener: () => void): () => void {
	sudoListeners.add(listener);
	return () => {
		sudoListeners.delete(listener);
	};
}

function SetSudoExpires(expires: number): void {
	sudoExpires = expires;
	for (const listener of sudoListeners) {
		listener();
	}
}

function ClearSudoMode(): void {
	SetSudoExpires(0);
}

export function useSudoMode(): {
	sudoActive: boolean;
	sudoExpires: number;
	clearSudoMode: () => void;
} {
	const expires = useSyncExternalStore(SubscribeSudo, GetSudoSnapshot, GetSudoSnapshot);
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
	onSudo,
	theme = 'default',
}: {
	children?: ReactNode;
	disabled?: boolean;
	onSudo?: () => void;
	theme?: ButtonTheme;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [showPrompt, setShowPrompt] = React.useState(false);
	const [password, setPassword] = React.useState('');

	const [authenticate, processing] = useAsyncEvent(async () => {
		return await directoryConnector.awaitResponse('sudoAuthenticate', {
			passwordSha512: await PrehashPassword(password),
		});
	}, (response) => {
		switch (response.result) {
			case 'ok':
				SetSudoExpires(response.expires);
				setPassword('');
				setShowPrompt(false);
				toast('Identity confirmed', TOAST_OPTIONS_SUCCESS);
				onSudo?.();
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

	const hide = React.useCallback(() => {
		if (processing)
			return;

		setPassword('');
		setShowPrompt(false);
	}, [processing]);

	const submit = React.useCallback((ev: React.SubmitEvent) => {
		ev.preventDefault();
		if (password.length === 0 || processing)
			return;

		authenticate();
	}, [authenticate, password.length, processing]);

	return (
		<>
			<Button theme={ theme } disabled={ disabled } onClick={ () => setShowPrompt(true) }>
				{ children }
			</Button>
			{
				showPrompt ? (
					<ModalDialog priority={ 10 }>
						<Form dirty={ false } onSubmit={ submit }>
							<Column>
								<h3>Confirm your identity</h3>
								<FormField>
									<label htmlFor='sudo-current-password'>Password</label>
									<TextInput
										password
										id='sudo-current-password'
										autoComplete='current-password'
										autoFocus
										value={ password }
										onChange={ setPassword }
										disabled={ processing }
									/>
								</FormField>
								<Row>
									<Button onClick={ hide } disabled={ processing }>
										Cancel
									</Button>
									<Button type='submit' disabled={ processing || password.length === 0 }>
										Confirm
									</Button>
								</Row>
							</Column>
						</Form>
					</ModalDialog>
				) : null
			}
		</>
	);
}
