import { AssertNotNullable, FormatTimeInterval, GetRestrictionOverrideConfig, RestrictionOverride } from 'pandora-common';
import React, { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { PlayerCharacter } from '../../character/player';
import { ChildrenProps } from '../../common/reactTypes';
import { useCurrentTime } from '../../common/useCurrentTime';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';
import { Button } from '../common/button/button';
import { Row } from '../common/container/container';
import { ModalDialog } from '../dialog/dialog';
import { usePlayer } from '../gameContext/playerContextProvider';
import { useAppearanceActionEvent } from '../gameContext/shardConnectorContextProvider';
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
	const restrictionOverride = state?.restrictionOverride;
	const currentTime = useCurrentTime();

	const canLeaveSafemode = restrictionOverride != null && currentTime >= restrictionOverride.allowLeaveAt;

	const hide = useCallback(() => safemodeContext.hide(), [safemodeContext]);
	useKeyDownEvent(useCallback(() => {
		hide();
		return true;
	}, [hide]), 'Escape');

	const [doSafeModeExit, exiting] = useAppearanceActionEvent({
		type: 'safemode',
		action: 'exit',
	});
	const [doSafeModeEnter, entering] = useAppearanceActionEvent({
		type: 'safemode',
		action: 'enter',
	});
	const processing = exiting || entering;

	return (
		<ModalDialog>
			<h3>
				Safemode
			</h3>
			<CharacterSafemodeHelpText />
			<p>
				Safemode should be seen as a last resort for when OOC-talk about limits fails, or you<br />
				are not fine with what is happening and require a quick out to feel safe again. Please be mindful that<br />
				there is a real person behind every character. Therefore, it is recommended to communicate issues first<br />
				Out of Character (OOC) by using the '/ooc' command or by prefixing a message with<br />
				double round brackets '(('.
			</p>
			{
				restrictionOverride?.type === 'safemode' ? (
					<>
						<p>
							<strong>You are currently in a safemode!</strong><br />
							{
								canLeaveSafemode ? null : <>You need to wait { FormatTimeInterval(restrictionOverride.allowLeaveAt - currentTime) } before you can leave the safemode.</>
							}
						</p>
						<Row padding='medium' alignX='space-between'>
							<Button onClick={ hide }>Cancel</Button>
							<Button
								disabled={ !canLeaveSafemode || processing }
								className='fadeDisabled'
								onClick={ doSafeModeExit }
							>
								Leave safemode
							</Button>
						</Row>
					</>
				) : (
					<>
						<p>
							<i>You are currently not in safemode.</i>
						</p>
						<p>
							<strong>Warning:</strong> After entering safemode, you will not be able to leave it for { FormatTimeInterval(GetRestrictionOverrideConfig('safemode').allowLeaveAt) }!
						</p>
						<Row padding='medium' alignX='space-between'>
							<Button onClick={ hide }>Cancel</Button>
							<Button onClick={ doSafeModeEnter } disabled={ processing }>
								Enter safemode!
							</Button>
						</Row>
					</>
				)
			}
		</ModalDialog>
	);
}

export function CharacterSafemodeWarningContent({ mode }: { mode?: RestrictionOverride; }): ReactElement | null {
	if (!mode)
		return null;

	switch (mode.type) {
		case 'safemode':
			return (
				<div className='safemode'>
					This character is in safemode!
					<ContextHelpButton>
						<CharacterSafemodeHelpText />
						<p>
							As general hint: You can find safemode for your character in the top left menu, by clicking on<br />
							your character's name.
						</p>
					</ContextHelpButton>
				</div>
			);
	}
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
				<b>While a character is in safemode, no one else can modify the character's items.</b> Additionally,<br />
				a character in safemode cannot modify items on other characters.
			</p>
		</>
	);
}
