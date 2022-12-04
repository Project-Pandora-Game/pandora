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
import { ContextHelpButton } from '../help/contextHelpButton';

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
			<CharacterSafemodeHelpText />
			<p>
				Safemode should be seen as a last resort for when OOC interaction about limits fails or you<br />
				are not fine with what is happening and require a quick out to feel safe again. Please be mindful that<br />
				there is a person behind every character. Therefore, it is recommended to communicate issues first<br />
				Out of Character (OOC) by using the &apos;/ooc&apos; command or by prefixing a message with<br />
				double round brackets &apos;((&apos;.
			</p>
			{
				safemodeState ? (
					<>
						<p>
							<strong>You are currently in a safemode!</strong><br />
							{
								canLeave ? null : <>You need to wait { FormatTimeInterval(safemodeState.allowLeaveAt - currentTime) } before you can leave the safemode.</>
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
							You are currently not in safemode.<br />
							<strong>Warning:</strong> After entering safemode, you will not be able to leave it for { FormatTimeInterval(SAFEMODE_EXIT_COOLDOWN) }!
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

export function CharacterSafemodeWarningContent(): ReactElement {
	return (
		<>
			This character is in safemode!
			<ContextHelpButton>
				<CharacterSafemodeHelpText />
				<p>
					As general hint: You can find safemode for your character in the top left menu, by clicking on<br />
					your character&apos;s name.
				</p>
			</ContextHelpButton>
		</>
	);
}

function CharacterSafemodeHelpText(): ReactElement {
	return (
		<>
			<p>
				Safemode is a mode in which items do not apply any restrictions to the character in this mode.<br />
				This means that the character can modify their appearance and items without any limits<br />
				(except if the room limits usage or spawning of certain items).<br />
				For instance, characters in safe mode can generally open/remove any lock on themselves.
			</p>
			<p>
				While a character is in safemode, no one else can modify the character&apos;s items. Additionally,<br />
				a character in safemode cannot modify items on other characters.
			</p>
		</>
	);
}
