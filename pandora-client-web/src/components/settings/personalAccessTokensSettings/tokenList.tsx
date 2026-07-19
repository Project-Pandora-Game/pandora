import { AssertNever, type PandoraAccessToken, type PandoraAccessTokenInfo } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { ButtonConfirm } from '../../dialog/dialog.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { useSudoMode } from '../securitySettings/sudoMode.tsx';
import { PATCreatedDialog, PATEditDialog } from './tokenDialog.tsx';

export function PATList({ tokenList }: {
	tokenList: readonly PandoraAccessTokenInfo[];
}): ReactElement {
	return (
		<table>
			<thead>
				<tr>
					<th>Token</th>
					<th>Expires</th>
					<th>Last Used</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{ tokenList.map((t) => (
					<PATListToken key={ t.id }
						token={ t }
					/>
				)) }
			</tbody>
		</table>
	);
}

function PATListToken({ token }: {
	token: PandoraAccessTokenInfo;
}): ReactElement {
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [showDetails, setShowDetails] = useState(false);
	const [showRegeneratedDialog, setShowRegeneratedDialog] = useState<PandoraAccessToken | null>(null);

	const [deleteToken, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('accessTokenDelete', { id: token.id }),
		({ result }) => {
			if (result === 'ok') {
				toast('Token deleted', TOAST_OPTIONS_SUCCESS);
			} else if (result === 'sudoRequired') {
				toast('Please re-authenticate before deleting the token', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result === 'notFound') {
				toast('Failed to delete token: ' + result, TOAST_OPTIONS_ERROR);
			} else {
				AssertNever(result);
			}
		},
	);

	return (
		<tr>
			<td>
				<strong>
					<a onClick={ (ev) => {
						ev.preventDefault();

						setShowDetails(true);
					} }>
						{ token.name || token.id }
					</a>
				</strong>
			</td>
			<td>
				{ token.expires == null ? (
					'Never'
				) : (
					new Date(token.expires).toLocaleString()
				) }
			</td>
			<td>
				{ token.lastUsed == null ? (
					'Never'
				) : (
					new Date(token.lastUsed).toLocaleString()
				) }
			</td>
			<td>
				<ButtonConfirm
					theme='danger'
					slim
					disabled={ !sudoActive || processing }
					title='Delete token'
					content={ `Are you sure you want to delete token ${token.name}?\nAny application using this token will loose access to your account.` }
					onClick={ deleteToken }
				>
					Delete
				</ButtonConfirm>
			</td>
			{ showDetails ? (
				<PATEditDialog
					close={ () => {
						setShowDetails(false);
					} }
					onRegenerated={ (secret) => {
						setShowDetails(false);
						setShowRegeneratedDialog(secret);
					} }
					token={ token }
				/>
			) : null }
			{ showRegeneratedDialog != null ? (
				<PATCreatedDialog
					close={ () => {
						setShowRegeneratedDialog(null);
					} }
					secret={ showRegeneratedDialog }
					token={ token }
				/>
			) : null }
		</tr>
	);
}
