import { noop } from 'lodash-es';
import { LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT, PandoraAccessToken, type PandoraAccessTokenInfo } from 'pandora-common';
import { useCallback, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import plusIcon from '../../../assets/icons/plus.svg';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../common/button/button.tsx';
import { Row } from '../../common/container/container.tsx';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { SudoModeButton, useSudoMode } from '../securitySettings/sudoMode.tsx';
import { PATCreatedDialog, PATCreateDialog } from './tokenDialog.tsx';
import { PATList } from './tokenList.tsx';

export function PersonalAccessTokensSettings(): ReactElement {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return <PersonalAccessTokensSettingsInner />;
}

function PersonalAccessTokensSettingsInner(): ReactElement {
	const [data, setData] = useState<readonly PandoraAccessTokenInfo[] | null>(null);
	const directoryConnector = useDirectoryConnector();

	const fetchTokens = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('accessTokensList', {});
		setData(result.tokens);
	}, [directoryConnector]);

	useDirectoryChangeListener('accessTokens', () => {
		fetchTokens().catch(noop);
	});

	return (
		<>
			<PATHeader
				tokenList={ data }
			/>
			<PATExisting
				tokenList={ data }
			/>
		</>
	);
}

function PATHeader({ tokenList }: {
	tokenList: readonly PandoraAccessTokenInfo[] | null;
}): ReactElement {
	const { sudoActive } = useSudoMode();

	const [showCreationDialog, setShowCreationDialog] = useState(false);
	const [showCreatedDialog, setShowCreatedDialog] = useState<[PandoraAccessToken, PandoraAccessTokenInfo] | null>(null);

	return (
		<fieldset>
			<Row alignX='space-between' padding='large' gap='x-large'>
				<Button
					onClick={ () => {
						if (tokenList == null || !sudoActive)
							return;

						if (tokenList.length >= LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT) {
							toast(
								`Access Token limit reached:\nYou can have at most ${LIMIT_ACCOUNT_ACCESS_TOKEN_COUNT} access tokens tied to your account.\nEither delete an existing token to free up space or reuse it.`,
								TOAST_OPTIONS_ERROR,
							);
							return;
						}

						setShowCreationDialog(true);
					} }
					disabled={ tokenList == null || !sudoActive }
				>
					<img src={ plusIcon } />Create new token
				</Button>
				<SudoModeButton
					theme={ sudoActive ? 'defaultActive' : 'default' }
					disabled={ sudoActive }
				>
					Allow changes
				</SudoModeButton>
			</Row>
			{ showCreationDialog ? (
				<PATCreateDialog
					close={ () => {
						setShowCreationDialog(false);
					} }
					onCreated={ (secret, info) => {
						setShowCreationDialog(false);
						setShowCreatedDialog([secret, info]);
					} }
				/>
			) : null }
			{ showCreatedDialog != null ? (
				<PATCreatedDialog
					close={ () => {
						setShowCreatedDialog(null);
					} }
					secret={ showCreatedDialog[0] }
					token={ showCreatedDialog[1] }
				/>
			) : null }
		</fieldset>
	);
}

function PATExisting({ tokenList }: {
	tokenList: readonly PandoraAccessTokenInfo[] | null;
}): ReactElement {
	return (
		<fieldset>
			<legend>Access Tokens</legend>
			{ tokenList == null ? (
				<span>Loading…</span>
			) : tokenList.length === 0 ? (
				<span><i>You have no access tokens yet</i></span>
			) : (
				<PATList
					tokenList={ tokenList }
				/>
			) }
		</fieldset>
	);
}
