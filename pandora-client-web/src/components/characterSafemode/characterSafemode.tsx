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
	const { hide } = useSafemodeDialogContext();
	const roomContext = useChatroomRequired();
	const state = useCharacterState(roomContext, player.id);
	const restrictionOverride = state?.restrictionOverride;

	useKeyDownEvent(useCallback(() => {
		hide();
		return true;
	}, [hide]), 'Escape');

	const [doModeExit, exiting] = useAppearanceActionEvent({
		type: 'restrictionOverrideChange',
		mode: 'normal',
	});
	const [doSafeModeEnter, entering] = useAppearanceActionEvent({
		type: 'restrictionOverrideChange',
		mode: 'safemode',
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
				restrictionOverride != null ? (
					<CharacterRestrictionOverrideLeave
						{ ...restrictionOverride }
						doModeExit={ doModeExit }
						processing={ processing }
					/>
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

function GetRestrictionOverrideText(type: RestrictionOverride['type']): string {
	switch (type) {
		case 'safemode':
			return 'safemode';
		case 'timeout':
			return 'timeout mode';
	}
}

function CharacterRestrictionOverrideLeave({ type, allowLeaveAt, doModeExit, processing }: RestrictionOverride & {
	doModeExit: () => void;
	processing: boolean;
}): ReactElement {
	const currentTime = useCurrentTime();
	const canLeave = currentTime >= allowLeaveAt;
	const mode = GetRestrictionOverrideText(type);
	const { hide } = useSafemodeDialogContext();

	return (
		<>
			<p>
				<strong>You are currently in a { mode }!</strong><br />
				{
					canLeave ? null : <>You need to wait { FormatTimeInterval(allowLeaveAt - currentTime) } before you can leave the { mode }.</>
				}
			</p>
			<Row padding='medium' alignX='space-between'>
				<Button onClick={ hide }>Cancel</Button>
				<Button
					disabled={ !canLeave || processing }
					className='fadeDisabled'
					onClick={ doModeExit }
				>
					Leave { mode }
				</Button>
			</Row>
		</>
	);
}

export function CharacterSafemodeWarningContent({ mode }: { mode?: RestrictionOverride; }): ReactElement | null {
	if (!mode)
		return null;

	let HelpText: () => ReactElement;

	switch (mode.type) {
		case 'safemode':
			HelpText = CharacterSafemodeHelpText;
			break;
		case 'timeout':
			HelpText = CharacterTimeoutModeHelpText;
			break;
	}

	return (
		<div className='safemode'>
			This character is in { GetRestrictionOverrideText(mode.type) }
			<ContextHelpButton>
				<HelpText />
				<p>
					As general hint: You can find safemode and timeout mode for your character in the top left menu, by clicking on<br />
					your character's name.
				</p>
			</ContextHelpButton>
		</div>
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
				<b>While a character is in safemode, no one else can modify the character's items.</b> Additionally,<br />
				a character in safemode cannot modify items on other characters.
			</p>
		</>
	);
}

function CharacterTimeoutModeHelpText(): ReactElement {
	return (
		<p>
			<b>Timeout mode is a mode in which no one else can modify the character's items.</b> Additionally,<br />
			a character in timeout mode cannot modify items on other characters.
			(Unlike safemode, all restrictions still apply to the character in timeout mode.)
		</p>
	);
}
