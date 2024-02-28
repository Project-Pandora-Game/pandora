import { AssetFrameworkRoomState, GenerateInitialRoomPosition, ICharacterRoomData, type AppearanceAction, type AssetFrameworkCharacterState } from 'pandora-common';
import React, {
	ReactElement,
	useMemo,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Character, useCharacterData } from '../../../character/character';
import { CharacterRestrictionOverrideWarningContent, GetRestrictionOverrideText, useRestrictionOverrideDialogContext } from '../../../components/characterRestrictionOverride/characterRestrictionOverride';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { useGameState, useGlobalState } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue';
import { useWardrobeExecuteChecked } from '../../../components/wardrobe/wardrobeContext';
import { useChatInput } from '../../components/chat/chatInput';

export function SpaceControlCharacter({ char }: { char: Character<ICharacterRoomData>; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const location = useLocation();
	const gameState = useGameState();
	const { show: showRestrictionOverrideContext } = useRestrictionOverrideDialogContext();

	const data = useCharacterData(char);
	const globalState = useGlobalState(gameState);
	const characterState = globalState.characters.get(char.id) ?? null;
	const roomState = characterState != null ? globalState.getRoomState(characterState.getCurrentRoomId()) : null;
	const isOnline = data.isOnline;

	const isPlayer = char.id === playerId;

	return (
		<fieldset>
			<legend className={ char.isPlayer() ? 'player' : '' }>
				<span>
					<span>
						<span className='colorStrip' style={ { color: data.settings.labelColor } }><b>{ '/// ' }</b></span>
						<span onClick={ () => setTarget(data.id) }><b>{ data.name }</b></span>
						<span> / { data.id } / { data.accountId }</span>
					</span>
				</span>
				{ isOnline ? null : (
					<span className='offline'>
						Offline
					</span>
				) }
				<CharacterRestrictionOverrideWarningContent mode={ characterState?.restrictionOverride } />
			</legend>
			<Column>
				<Row wrap>
					<Button className='slim' onClick={ () => {
						navigate(`/wardrobe/character/${data.id}`);
					} }>
						Wardrobe
					</Button>
					<Button className='slim' onClick={ () => {
						navigate(`/profiles/character/${data.id}`, {
							state: {
								back: location.pathname,
							},
						});
					} }>
						Profile
					</Button>
					{ !isPlayer && (
						<Button className='slim' onClick={ () => {
							setTarget(data.id);
						} }>
							Whisper
						</Button>
					) }
					{ isPlayer && (
						<Button className='slim' onClick={ showRestrictionOverrideContext }>
							{ characterState?.restrictionOverride ? `Exit ${GetRestrictionOverrideText(characterState?.restrictionOverride.type)}` : 'Enter safemode' }
						</Button>
					) }
					{
						(isPlayer && characterState != null && roomState != null) ? (
							<CharacterSpectatorModeControl characterState={ characterState } roomState={ roomState } />
						) : null
					}
				</Row>
			</Column>
		</fieldset>
	);
}

function CharacterSpectatorModeControl({ characterState, roomState }: {
	characterState: AssetFrameworkCharacterState;
	roomState: AssetFrameworkRoomState;
}): ReactElement {
	const enterSpectatorModeAction = useMemo((): AppearanceAction => ({
		type: 'characterMove',
		target: characterState.id,
		position: {
			type: 'spectator',
			roomId: roomState.id,
		},
	}), [characterState.id, roomState]);
	const enterSpectatorModeActionCheck = useStaggeredAppearanceActionResult(enterSpectatorModeAction);
	const [executeEnterSpectatorMode, processingEnterSpectatorMode] = useWardrobeExecuteChecked(enterSpectatorModeAction, enterSpectatorModeActionCheck);

	const exitSpectatorModeAction = useMemo((): AppearanceAction => ({
		type: 'characterMove',
		target: characterState.id,
		position: {
			type: 'normal',
			roomId: roomState.id,
			position: GenerateInitialRoomPosition(roomState.getResolvedBackground()),
		},
	}), [characterState.id, roomState]);
	const exitSpectatorModeActionCheck = useStaggeredAppearanceActionResult(exitSpectatorModeAction);
	const [executeExitSpectatorMode, processingExitSpectatorMode] = useWardrobeExecuteChecked(exitSpectatorModeAction, exitSpectatorModeActionCheck);

	return (
		<>
			{ characterState.position.type === 'normal' ? (
				<Button className='slim fadeDisabled' onClick={ executeEnterSpectatorMode } disabled={ processingEnterSpectatorMode }>
					Enter spectator mode
				</Button>
			) : null }
			{ characterState.position.type === 'spectator' ? (
				<Button className='slim fadeDisabled' onClick={ executeExitSpectatorMode } disabled={ processingExitSpectatorMode }>
					Exit spectator mode
				</Button>
			) : null }
		</>
	);
}
