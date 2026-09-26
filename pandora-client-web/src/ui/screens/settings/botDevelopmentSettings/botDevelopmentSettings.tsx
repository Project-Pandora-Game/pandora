import { noop } from 'lodash-es';
import { AssertNever, IsAuthorized } from 'pandora-common';
import { BotDefinition, type BotConfig, type BotId } from 'pandora-common/bots';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import plusIcon from '../../../../assets/icons/plus.svg';
import { Button } from '../../../../components/common/button/button.tsx';
import { Row } from '../../../../components/common/container/container.tsx';
import { useDirectoryConnector } from '../../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { useCurrentAccount } from '../../../../services/accountLogic/accountManagerHooks.ts';
import { SudoModeButton, useSudoMode } from '../securitySettings/sudoMode.tsx';
import { BotCreatedDialog, BotCreateDialog } from './botDialog.tsx';
import { BotDefinitionList } from './botList.tsx';

export function BotDevelopmentSettings(): ReactElement {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	const isBotDeveloper = IsAuthorized(account.roles, 'bot-developer');

	if (!isBotDeveloper)
		return <>You are not authorized bot developer</>;

	return <BotDevelopmentSettingsInner />;
}

function BotDevelopmentSettingsInner(): ReactElement {
	const [data, setData] = useState<readonly BotDefinition[] | null>(null);
	const directoryConnector = useDirectoryConnector();

	const fetchBotList = useCallback(() => {
		(async () => {
			const result = await directoryConnector.awaitResponse('botDevelopmentListOwned', {});
			if (result.result === 'notLoggedIn') {
				setData(null);
			} else if (result.result === 'ok') {
				setData(result.bots);
			} else {
				AssertNever(result);
			}
		})().catch(noop);
	}, [directoryConnector]);

	useEffect(() => {
		fetchBotList();
	}, [fetchBotList]);

	return (
		<>
			<BotDevelopmentHeader
				botList={ data }
				reload={ fetchBotList }
			/>
			<BotDefinitionsExisting
				botList={ data }
				reload={ fetchBotList }
			/>
		</>
	);
}

function BotDevelopmentHeader({ botList, reload }: {
	botList: readonly BotDefinition[] | null;
	reload: () => void;
}): ReactElement {
	const { sudoActive } = useSudoMode();

	const [showCreationDialog, setShowCreationDialog] = useState(false);
	const [showCreatedDialog, setShowCreatedDialog] = useState<[BotId, BotConfig] | null>(null);

	return (
		<fieldset>
			<Row alignX='space-between' padding='large' gap='x-large'>
				<Button
					onClick={ () => {
						if (botList == null || !sudoActive)
							return;

						setShowCreationDialog(true);
					} }
					disabled={ botList == null || !sudoActive }
				>
					<img src={ plusIcon } />Create new bot definition
				</Button>
				<SudoModeButton
					theme={ sudoActive ? 'defaultActive' : 'default' }
					disabled={ sudoActive }
				>
					Allow changes
				</SudoModeButton>
			</Row>
			{ showCreationDialog ? (
				<BotCreateDialog
					close={ () => {
						setShowCreationDialog(false);
					} }
					onCreated={ (secret, info) => {
						setShowCreationDialog(false);
						setShowCreatedDialog([secret, info]);
						reload();
					} }
				/>
			) : null }
			{ showCreatedDialog != null ? (
				<BotCreatedDialog
					close={ () => {
						setShowCreatedDialog(null);
					} }
					id={ showCreatedDialog[0] }
					config={ showCreatedDialog[1] }
				/>
			) : null }
		</fieldset>
	);
}

function BotDefinitionsExisting({ botList, reload }: {
	botList: readonly BotDefinition[] | null;
	reload: () => void;
}): ReactElement {
	return (
		<fieldset>
			<legend>Bot Definitions</legend>
			{ botList == null ? (
				<span>Loading…</span>
			) : botList.length === 0 ? (
				<span><i>You have created no bots yet</i></span>
			) : (
				<BotDefinitionList
					botList={ botList }
					reload={ reload }
				/>
			) }
		</fieldset>
	);
}
