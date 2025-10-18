import { AssertNever, type ChatMessageActionLogGameLogicAction } from 'pandora-common';
import { createContext, useContext, type ReactElement } from 'react';
import { useGameState, useGlobalState } from '../../../components/gameContext/gameStateContextProvider.tsx';
import type { ChatActionLogMessageProcessed } from './chatMessages.tsx';
import { DescribeGameLogicAction } from './chatMessagesDescriptions.tsx';

export const ActionLogDisplayEntriesContext = createContext(false);

export function ActionLogEntry({ entry }: {
	entry: ChatActionLogMessageProcessed;
}): ReactElement | null {
	const display = useContext(ActionLogDisplayEntriesContext);
	if (!display)
		return null;

	const time = new Date(entry.time);

	return (
		<div className='message actionLogEntry'>
			<span>
				{ `[${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)}] ` }
			</span>
			{ entry.entry[0] === 'gameLogic' ? (
				<ActionLogEntryGameLogic entry={ entry.entry[1] } />
			) : AssertNever() }
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

