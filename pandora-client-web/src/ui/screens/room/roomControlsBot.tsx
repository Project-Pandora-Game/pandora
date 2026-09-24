import type { ReactElement } from 'react';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { useGameState } from '../../../services/gameLogic/gameStateHooks.ts';
import './roomControlsBot.scss';

export function RoomControlsBotInfo(): ReactElement | null {
	const gameState = useGameState();
	const botState = useObservable(gameState.botState);

	if (botState == null)
		return null;

	return (
		<fieldset className='RoomControlsBotInfo'>
			<legend>
				<Row alignY='center'>
					<span>Space's Bot</span>
					<ContextHelpButton>
						<p>
							Bots are community-run projects that offer additional room for creativity by allowing
							their creators to extend spaces with various automated features.<br />
							Each space can have at most one bot active at a time.<br />
							<strong>Bots are an experimental feature and will change in the future!</strong>
						</p>
						<p>
							<strong>Bots are not official — they are hosted by community members like you!</strong><br />
							A bot can do anything with the access it has to the space.
							To see what this space's bot can do, see the "Features" tab in "Space Configuration" of this space.
						</p>
					</ContextHelpButton>
				</Row>
			</legend>
			<Column gap='tiny'>
				<Row wrap alignX='space-between'>
					<div>Bot: { botState.name }</div>
					<div className='text-dim'>Created by: { botState.creatorName } ({ botState.creatorId })</div>
				</Row>
				{ !botState.connected ? (
					<div className='warning-box'>
						The bot is not currently connected to this space.<br />
						Additional features offered by the bot are not available
						and some of Pandora's functionality might be limited, depending on the bot's settings.
					</div>
				) : null }
			</Column>
		</fieldset>
	);
}
