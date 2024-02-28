import React, {
	ReactElement,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/button/button';
import { useSpaceCharacters, useCharacterState, useSpaceInfo, useGameState, useGlobalState } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayerId, usePlayer } from '../../../components/gameContext/playerContextProvider';
import { useChatInput } from '../../components/chat/chatInput';
import { Column, Row } from '../../../components/common/container/container';
import { Character, useCharacterData } from '../../../character/character';
import { CharacterRestrictionOverrideWarningContent, useRestrictionOverrideDialogContext, GetRestrictionOverrideText } from '../../../components/characterRestrictionOverride/characterRestrictionOverride';
import { AssetFrameworkRoomState, ICharacterRoomData } from 'pandora-common';

export function SpaceControls(): ReactElement | null {
	const spaceConfig = useSpaceInfo().config;
	const characters = useSpaceCharacters();
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const player = usePlayer();
	const navigate = useNavigate();

	if (!player) {
		return null;
	}

	return (
		<Column padding='medium' className='controls'>
			<Row padding='small'>
				<Button onClick={ () => navigate('/wardrobe/space-inventory') } >Space inventory</Button>
				<Button onClick={ () => navigate('/space/configuration') }>Space configuration</Button>
			</Row>
			<br />
			<span>
				These rooms are part of the space <b>{ spaceConfig.name }</b>:
			</span>
			<Column>
				{
					globalState.space.rooms.map((room) => (
						<SpaceRoomControls
							key={ room.id }
							room={ room }
							characters={
								characters
									.filter((c) => {
										const state = globalState.getCharacterState(c.id);
										if (state == null || state.getCurrentRoomId() !== room.id)
											return false;

										return true;
									})
							}
						/>
					))
				}
			</Column>
		</Column>
	);
}

function SpaceRoomControls({ characters }: {
	characters: readonly Character<ICharacterRoomData>[];
	room: AssetFrameworkRoomState;
}): ReactElement {
	return (
		<fieldset>
			<legend>Room</legend>
			<div className='character-info'>
				{ characters.map((c) => <SpaceControlCharacter key={ c.id } char={ c } />) }
			</div>
		</fieldset>
	);
}

export function SpaceControlCharacter({ char }: { char: Character<ICharacterRoomData>; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const location = useLocation();
	const gameState = useGameState();
	const { show: showRestrictionOverrideContext } = useRestrictionOverrideDialogContext();

	const data = useCharacterData(char);
	const state = useCharacterState(gameState, char.id);
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
				<CharacterRestrictionOverrideWarningContent mode={ state?.restrictionOverride } />
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
							{ state?.restrictionOverride ? `Exit ${GetRestrictionOverrideText(state?.restrictionOverride.type)}` : 'Enter safemode' }
						</Button>
					) }
				</Row>
			</Column>
		</fieldset>
	);
}
