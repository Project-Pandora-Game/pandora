import { AssertNever, type ChatMessageActionLogGameLogicAction } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import sourceCodeIcon from '../../../assets/icons/source-code.svg';
import { IconButton } from '../../../components/common/button/button.tsx';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import { useGameState, useGlobalState } from '../../../services/gameLogic/gameStateHooks.ts';
import type { ChatActionLogMessageProcessed } from './chatMessageTypes.ts';
import { DescribeGameLogicAction } from './chatMessagesDescriptions.tsx';

export function ActionLogEntry({ entry }: {
	entry: ChatActionLogMessageProcessed;
}): ReactElement | null {
	const time = new Date(entry.time);

	const [showDetails, setShowDetails] = useState(false);

	return (
		<div className='message actionLogEntry' translate='no'>
			<span>
				{ `[${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)}] ` }
			</span>
			{ entry.entry[0] === 'gameLogic' ? (
				<ActionLogEntryGameLogic entry={ entry.entry[1] } />
			) : AssertNever() }
			<IconButton
				src={ sourceCodeIcon }
				alt='View full action details'
				onClick={ (ev) => {
					ev.stopPropagation();
					ev.preventDefault();
					setShowDetails((v) => !v);
				} }
			/>
			{ showDetails ? (
				<DraggableDialog title='Action log entry details' close={ () => {
					setShowDetails(false);
				} }>
					<pre>
						<code>
							{ JSON.stringify(entry.entry[1], undefined, '  ') }
						</code>
					</pre>
				</DraggableDialog>
			) : null }
		</div>
	);
}

function ActionLogEntryGameLogic({ entry }: {
	entry: ChatMessageActionLogGameLogicAction[1];
}): ReactElement {
	const globalState = useGlobalState(useGameState());

	return (
		<>
			<span style={ { backgroundColor: entry.actor.labelColor + '44' } }>{ entry.actor.name } ({ entry.actor.id })</span>
			{ ': ' }
			<DescribeGameLogicAction
				action={ entry.action }
				globalState={ globalState }
				actionOriginator={ entry.actor }
			/>
		</>
	);
}

