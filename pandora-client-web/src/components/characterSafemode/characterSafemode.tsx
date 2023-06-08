import { AssertNotNullable, FormatTimeInterval, SAFEMODE_EXIT_COOLDOWN } from 'pandora-common';
import React, { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { PlayerCharacter } from '../../character/player';
import { ChildrenProps } from '../../common/reactTypes';
import { useCurrentTime } from '../../common/useCurrentTime';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';
import { Button } from '../common/button/button';
import { Row } from '../common/container/container';
import { ModalDialog } from '../dialog/dialog';
import { usePlayer } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ContextHelpButton } from '../help/contextHelpButton';
import { useCharacterState, useChatroomRequired } from '../gameContext/chatRoomContextProvider';

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
	const roomContext = useChatroomRequired();
	const state = useCharacterState(roomContext, player.id);
	const safemodeState = state?.safemode ?? null;
	const shardConnector = useShardConnector();
	const currentTime = useCurrentTime();

	const canLeaveSafemode = safemodeState != null && currentTime >= safemodeState.allowLeaveAt;

	const hide = useCallback(() => safemodeContext.hide(), [safemodeContext]);
	useKeyDownEvent(() => {
		hide();
		return true;
	}, 'Escape');

	return (
		<ModalDialog>
			<h3>
				Safemode
			</h3>
			<CharacterSafemodeHelpText />
			<p>
				Safemode should be seen as a last resort for when OOC interaction about limits fails, or you<br />
				are not fine with what is happening and require a quick out to feel safe again. Please be mindful that<br />
				there is a person behind every character. Therefore, it is recommended to communicate issues first<br />
				Out of Character (OOC) by using the '/ooc' command or by prefixing a message with<br />
				double round brackets '(('.
			</p>
			{
				safemodeState ? (
					<>
						<p>
							<strong>You are currently in a safemode!</strong><br />
							{
								canLeaveSafemode ? null : <>You need to wait { FormatTimeInterval(safemodeState.allowLeaveAt - currentTime) } before you can leave the safemode.</>
							}
						</p>
						<Row padding='medium' alignX='space-between'>
							<Button onClick={ hide }>Cancel</Button>
							<Button
								disabled={ !canLeaveSafemode }
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
						<Row padding='medium' alignX='space-between'>
							<Button onClick={ hide }>Cancel</Button>
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
		</ModalDialog>
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
					your character's name.
				</p>
			</ContextHelpButton>
		</>
	);
}

function CharacterSafemodeHelpText(): ReactElement {
	return (
		<>
			<p>
				Safemode is a mode in which items do not apply any restrictions to the character in it.<br />
				This means that the character can modify their appearance and items without any limits<br />
				(except if the room limits usage or spawning of certain items).<br />
				For instance, characters in safe mode can generally open/remove any lock on themselves.
			</p>
			<p>
				While a character is in safemode, no one else can modify the character's items. Additionally,<br />
				a character in safemode cannot modify items on other characters.
			</p>
		</>
	);
}
