import { AssertNotNullable, FormatTimeInterval, SAFEMODE_EXIT_COOLDOWN } from 'pandora-common';
import React, { ReactElement, useContext, useMemo, useState } from 'react';
import { useCharacterSafemode } from '../../character/character';
import { PlayerCharacter } from '../../character/player';
import { ChildrenProps } from '../../common/reactTypes';
import { useCurrentTime } from '../../common/useCurrentTime';
import { Button } from '../common/Button/Button';
import { Row } from '../common/container/container';
import { Dialog } from '../dialog/dialog';
import { usePlayer } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';

export type SafemodeDialogContext = {
	show: () => void;
	hide: () => void;
};

const SafemodeDialogContext = React.createContext<SafemodeDialogContext | null>(null);

export function useSafemodeDialogContext(): SafemodeDialogContext {
	const context = useContext(SafemodeDialogContext);
	AssertNotNullable(context);
	return context;
}

export function CharacterSafemodeDialogContext({ children }: ChildrenProps): ReactElement {

	const [state, setState] = useState<boolean>(false);
	const player = usePlayer();

	const context = useMemo<SafemodeDialogContext>(() => ({
		show: () => setState(true),
		hide: () => setState(false),
	}), []);

	return (
		<SafemodeDialogContext.Provider value={ context }>
			{ children }
			{ state && player ? <CharacterSafemodeDialog player={ player } /> : null }
		</SafemodeDialogContext.Provider>
	);
}

export function CharacterSafemodeDialog({ player }: {
	player: PlayerCharacter;
}): ReactElement {
	const safemodeContext = useSafemodeDialogContext();
	const safemodeState = useCharacterSafemode(player);
	const shardConnector = useShardConnector();

	const currentTime = useCurrentTime();

	const canLeave = safemodeState != null && currentTime >= safemodeState.allowLeaveAt;

	return (
		<Dialog>
			<h3>
				Safemode
			</h3>
			<p>
				Safemode is a mode in which items don&apos;t apply any restrictions to your character.<br />
				This means you can modify your appearance and items without any limits (except those imposed by room you are in).<br />
				While in safemode nobody can modify your character, but also you cannot modify characters of others.
			</p>
			{
				safemodeState ? (
					<>
						<p>
							<strong>You are currently in a safemode!</strong><br />
							{
								canLeave ? null : <>You need to wait { FormatTimeInterval(safemodeState.allowLeaveAt - currentTime)} before you can leave the safemode.</>
							}
						</p>
						<Row alignX='space-between'>
							<Button onClick={ () => safemodeContext.hide() }>Cancel</Button>
							<Button
								disabled={ !canLeave }
								className='fadeDisabled'
								onClick={ () => {
									shardConnector?.sendMessage('appearanceAction', {
										type: 'safemode',
										action: 'exit',
									});
								} }
							>
								Leave safemode
							</Button>
						</Row>
					</>
				) : (
					<>
						<p>
							You currently aren&apos;t in a safemode.<br />
							<strong>Warning:</strong> After entering safemode you will not be able to leave it for { FormatTimeInterval(SAFEMODE_EXIT_COOLDOWN) }!
						</p>
						<Row alignX='space-between'>
							<Button onClick={ () => safemodeContext.hide() }>Cancel</Button>
							<Button onClick={ () => {
								shardConnector?.sendMessage('appearanceAction', {
									type: 'safemode',
									action: 'enter',
								});
							} }>
								Enter safemode!
							</Button>
						</Row>
					</>
				)
			}
		</Dialog>
	);
}
