import { AssertNever, LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT, PandoraAccessTokenNameSchema, PandoraAccessTokenScopeList, type PandoraAccessToken, type PandoraAccessTokenInfo } from 'pandora-common';
import { useId, useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { CopyToClipboardButton } from '../../../common/clipboard.tsx';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FormCreateStringValidator } from '../../common/form/form.tsx';
import { ModalDialog } from '../../dialog/dialog.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { SudoModeButton, useSudoMode } from '../securitySettings/sudoMode.tsx';
import { PAT_EXPIRY_DEFAULT, PATExpiryPresetToTime, PATExpirySelection, type PATExpiryPreset } from './expirySelection.tsx';
import { PATScopes } from './scopeSelection.tsx';

export function PATCreateDialog({ close, onCreated }: {
	close: () => void;
	onCreated: (token: PandoraAccessToken, info: PandoraAccessTokenInfo) => void;
}): ReactElement {
	const id = useId();
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [name, setName] = useState('');
	const [expires, setExpires] = useState<PATExpiryPreset>(PAT_EXPIRY_DEFAULT);
	const [scopes, setScopes] = useState<PandoraAccessTokenScopeList>([]);

	const nameError = useMemo(() => (
		FormCreateStringValidator(PandoraAccessTokenNameSchema, 'name')(name)
	), [name]);

	const [createToken, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('accessTokensCreate', {
			name,
			expires: PATExpiryPresetToTime(expires),
			scopes,
		}),
		(result) => {
			if (result.result === 'ok') {
				onCreated(result.token, result.info);
			} else if (result.result === 'sudoRequired') {
				toast('Please re-authenticate before creating the token', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result.result === 'limitReached') {
				toast(
					`Access Token limit reached:\nYou can have at most ${LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT} access tokens tied to your account.\nEither delete an existing token to free up space or reuse it.`,
					TOAST_OPTIONS_ERROR,
				);
			} else {
				AssertNever(result);
			}
		},
	);

	return (
		<ModalDialog>
			<Column>
				<h3>
					Create new Access Token
				</h3>
				<Column gap='small'>
					<label htmlFor={ id + ':name' }>Name (what is this token for?)</label>
					<TextInput
						id={ id + ':name' }
						value={ name }
						onChange={ (newName) => {
							setName(newName.trim());
						} }
					/>
					{ nameError ? (
						<span className='error'>{ nameError }</span>
					) : null }
				</Column>
				<PATExpirySelection
					expires={ expires }
					onChange={ setExpires }
				/>
				<PATScopes
					selectedScopes={ scopes }
					onChange={ setScopes }
				/>
				<Row alignX='space-between' wrap>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					{ sudoActive ? (
						<Button
							onClick={ createToken }
							disabled={ processing || nameError != null }
						>
							Create token
						</Button>
					) : (
						<SudoModeButton>
							Create token
						</SudoModeButton>
					) }
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function PATEditDialog({ close, onRegenerated, token }: {
	close: () => void;
	onRegenerated: (token: PandoraAccessToken) => void;
	token: PandoraAccessTokenInfo;
}): ReactElement {
	const id = useId();
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [regenerate, setRegenerate] = useState(false);

	const [name, setName] = useState<string | null>(null);
	const [scopes, setScopes] = useState<PandoraAccessTokenScopeList | null>(null);

	const [updateToken, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('accessTokenUpdate', {
			id: token.id,
			name: name ?? token.name,
			scopes: scopes ?? token.scopes,
		}),
		({ result }) => {
			if (result === 'ok') {
				close();
			} else if (result === 'sudoRequired') {
				toast('Please re-authenticate before performing these changes', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result === 'notFound') {
				toast(`Token not found`, TOAST_OPTIONS_ERROR);
				close();
			} else {
				AssertNever(result);
			}
		},
	);

	if (regenerate) {
		return (
			<PATRegenerateDialog
				close={ close }
				onRegenerated={ onRegenerated }
				token={ token }
			/>
		);
	}

	return (
		<ModalDialog>
			<Column>
				<h3>
					Access Token "{ token.name || token.id }"
				</h3>
				<Row className='warning-box' padding='medium' alignY='center'>
					<div>
						If you've lost or forgotten this token, or it has expired, you can regenerate it.
						Be aware that any scripts or applications using this token will need to be updated.
					</div>
					<Button
						theme='danger'
						onClick={ () => {
							setRegenerate(true);
						} }
					>
						Regenerate token
					</Button>
				</Row>
				<Column gap='small'>
					<label htmlFor={ id + ':name' }>Name (what is this token for?)</label>
					<TextInput
						id={ id + ':name' }
						value={ sudoActive ? (name ?? token.name) : token.name }
						disabled={ !sudoActive }
						onChange={ (newName) => {
							const parsed = PandoraAccessTokenNameSchema.safeParse(newName.trim());
							if (parsed.success) {
								setName(parsed.data);
							}
						} }
					/>
				</Column>
				<Column gap='small'>
					<strong>Expiration</strong>
					{ token.expires != null ? (
						<div>This token expires on { new Date(token.expires).toLocaleString() }. To update expiration you must regenerate the token.</div>
					) : (
						<div>This token will not expire. To update expiration you must regenerate the token.</div>
					) }
				</Column>
				<PATScopes
					selectedScopes={ sudoActive ? (scopes ?? token.scopes) : token.scopes }
					onChange={ sudoActive ? setScopes : null }
				/>
				<Row alignX='space-between' wrap>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					{ sudoActive ? (
						<Button
							onClick={ updateToken }
							disabled={ processing || (name == null && scopes == null) }
						>
							Update token
						</Button>
					) : (
						<SudoModeButton>
							Update token
						</SudoModeButton>
					) }
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function PATRegenerateDialog({ close, onRegenerated, token }: {
	close: () => void;
	onRegenerated: (token: PandoraAccessToken) => void;
	token: PandoraAccessTokenInfo;
}): ReactElement {
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [expires, setExpires] = useState<PATExpiryPreset>(PAT_EXPIRY_DEFAULT);

	const [regenerateToken, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('accessTokenRegenerate', {
			id: token.id,
			expires: PATExpiryPresetToTime(expires),
		}),
		(result) => {
			if (result.result === 'ok') {
				onRegenerated(result.token);
			} else if (result.result === 'sudoRequired') {
				toast('Please re-authenticate before creating the token', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result.result === 'notFound') {
				toast(`Token not found`, TOAST_OPTIONS_ERROR);
				close();
			} else {
				AssertNever(result);
			}
		},
	);

	return (
		<ModalDialog>
			<Column>
				<h3>
					Regenerate Access Token { token.name || token.id }
				</h3>
				<Row className='warning-box' padding='medium' alignY='center'>
					<div>
						Regenerating the token will invalidate the old token and generate a new one.
						Be aware that any scripts or applications using this token will need to be updated.
					</div>
				</Row>
				<PATExpirySelection
					expires={ expires }
					onChange={ setExpires }
				/>
				<Row alignX='space-between' wrap>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					{ sudoActive ? (
						<Button
							theme='danger'
							onClick={ () => {
								regenerateToken();
							} }
							disabled={ processing }
						>
							Regenerate token
						</Button>
					) : (
						<SudoModeButton theme='danger'>
							Regenerate token
						</SudoModeButton>
					) }
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function PATCreatedDialog({ close, secret }: {
	close: () => void;
	token: PandoraAccessTokenInfo;
	secret: PandoraAccessToken;
}): ReactElement {
	return (
		<ModalDialog>
			<Column>
				<h3>Token created</h3>
				<div>Make sure to save the token now. You won't be able to see it again!</div>
				<Column padding='medium'>
					<CopyToClipboardButton
						text={ secret }
						buttonText='Copy to clipboard'
						className='align-self-end'
					/>
					<pre>
						<code className='selectable-all'>
							{ secret }
						</code>
					</pre>
				</Column>
				<Row alignX='center'>
					<Button
						onClick={ close }
					>
						Close
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
