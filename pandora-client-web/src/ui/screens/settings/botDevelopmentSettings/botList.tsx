import { AssertNever } from 'pandora-common';
import type { BotDefinition } from 'pandora-common/bots';
import { useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../../common/useEvent.ts';
import { InteractiveLink } from '../../../../components/common/link/interactiveLink.tsx';
import { ButtonConfirm } from '../../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../../persistentToast.ts';
import { useSudoMode } from '../securitySettings/sudoMode.tsx';
import { BotEditDialog } from './botDialog.tsx';

export function BotDefinitionList({ botList, reload }: {
	botList: readonly BotDefinition[];
	reload: () => void;
}): ReactElement {
	return (
		<table>
			<thead>
				<tr>
					<th>Bot</th>
					<th>Visibility</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{ botList.map((it) => (
					<BotDefinitionListItem key={ it.id }
						botDefinition={ it }
						reload={ reload }
					/>
				)) }
			</tbody>
		</table>
	);
}

function BotDefinitionListItem({ botDefinition, reload }: {
	botDefinition: BotDefinition;
	reload: () => void;
}): ReactElement {
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [showDetails, setShowDetails] = useState(false);

	const [deleteBot, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('botDevelopmentDelete', { id: botDefinition.id }),
		({ result }) => {
			if (result === 'ok') {
				toast('Bot deleted', TOAST_OPTIONS_SUCCESS);
			} else if (result === 'sudoRequired') {
				toast('Please re-authenticate before deleting the bot', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result === 'notFound') {
				toast('Failed to delete bot: ' + result, TOAST_OPTIONS_ERROR);
			} else {
				AssertNever(result);
			}
			reload();
		},
	);

	return (
		<tr>
			<td>
				<strong>
					<InteractiveLink
						onClick={ () => {
							setShowDetails(true);
						} }
					>
						{ botDefinition.name || botDefinition.id }
					</InteractiveLink>
				</strong>
			</td>
			<td>
				{ botDefinition.private ? (
					'Private'
				) : (
					'Public'
				) }
			</td>
			<td>
				<ButtonConfirm
					theme='danger'
					slim
					disabled={ !sudoActive || processing }
					title='Delete bot'
					content={ `Are you sure you want to delete bot ${botDefinition.name} (${botDefinition.id})?\nThe bot will be removed from all spaces using it. This cannot be undone.` }
					onClick={ deleteBot }
				>
					Delete
				</ButtonConfirm>
			</td>
			{ showDetails ? (
				<BotEditDialog
					close={ () => {
						setShowDetails(false);
					} }
					onChange={ reload }
					botDefinition={ botDefinition }
				/>
			) : null }
		</tr>
	);
}
