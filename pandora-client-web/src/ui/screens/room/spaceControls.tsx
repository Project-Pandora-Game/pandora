import type { Immutable } from 'immer';
import { AssertNever, AssertNotNullable, AssetFrameworkRoomState, CloneDeepMutable, GenerateInitialRoomPosition, ICharacterRoomData, ITEM_LIMIT_SPACE_ROOMS, type AppearanceAction, type AssetFrameworkCharacterState, type AssetFrameworkGlobalState, type RoomBackgroundConfig, type RoomId } from 'pandora-common';
import React, {
	ReactElement,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import deleteIcon from '../../../assets/icons/delete.svg';
import { Character, useCharacterData } from '../../../character/character';
import { CharacterRestrictionOverrideWarningContent, GetRestrictionOverrideText, useRestrictionOverrideDialogContext } from '../../../components/characterRestrictionOverride/characterRestrictionOverride';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { useCurrentAccount } from '../../../components/gameContext/directoryConnectorContextProvider';
import { IsSpaceAdmin, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerId, usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue';
import { WardrobeContextProvider, useWardrobeExecuteChecked } from '../../../components/wardrobe/wardrobeContext';
import { useChatInput } from '../../components/chat/chatInput';
import { BackgroundSelector } from '../spaceConfiguration/backgroundSelection';

export function SpaceControls(): ReactElement | null {
	const spaceConfig = useSpaceInfo().config;
	const characters = useSpaceCharacters();
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const player = usePlayer();
	const navigate = useNavigate();

	const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
	const selectedRoom = selectedRoomId != null ? globalState.space.getRoomState(selectedRoomId) : null;

	useEffect(() => {
		if (selectedRoomId != null && selectedRoom == null) {
			setSelectedRoomId(null);
		}
	}, [selectedRoomId, selectedRoom]);

	if (!player) {
		return null;
	}

	return (
		<WardrobeContextProvider target={ { type: 'spaceInventory' } } player={ player }>
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
								isSelected={ room.id === selectedRoomId }
								onSelect={ () => {
									setSelectedRoomId(room.id);
								} }
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
					<CreateRoom globalState={ globalState } />
				</Column>
				{
					selectedRoom != null ? (
						<SpaceRoomConfig
							key={ selectedRoom.id }
							room={ selectedRoom }
						/>
					) : null
				}
			</Column>
		</WardrobeContextProvider>
	);
}

function CreateRoom({ globalState }: {
	globalState: AssetFrameworkGlobalState;
}): ReactElement | null {
	const currentAccount = useCurrentAccount();
	AssertNotNullable(currentAccount);
	const currentSpaceInfo = useSpaceInfo();
	const isPlayerAdmin = IsSpaceAdmin(currentSpaceInfo.config, currentAccount);

	const action = useMemo((): AppearanceAction => ({
		type: 'spaceConfigure',
		configureAction: {
			type: 'roomCreate',
		},
	}), []);
	const check = useStaggeredAppearanceActionResult(action);
	const [execute, processing] = useWardrobeExecuteChecked(action, check);

	if (!isPlayerAdmin || globalState.space.rooms.length >= ITEM_LIMIT_SPACE_ROOMS)
		return null;

	return (
		<fieldset>
			<Button
				className='fill fadeDisabled'
				onClick={ execute }
				disabled={ processing }
			>
				Add a new room
			</Button>
		</fieldset>
	);
}

function SpaceRoomControls({ characters, room, isSelected, onSelect }: {
	characters: readonly Character<ICharacterRoomData>[];
	room: AssetFrameworkRoomState;
	isSelected: boolean;
	onSelect: () => void;
}): ReactElement {
	const { playerState } = usePlayerState();

	const moveToRoomAction = useMemo((): AppearanceAction => {
		if (playerState.position.type === 'normal') {
			return {
				type: 'characterMove',
				target: playerState.id,
				position: {
					type: 'normal',
					roomId: room.id,
					position: GenerateInitialRoomPosition(room.getResolvedBackground()),
				},
			};
		} else if (playerState.position.type === 'spectator') {
			return {
				type: 'characterMove',
				target: playerState.id,
				position: {
					type: 'spectator',
					roomId: room.id,
				},
			};
		}

		AssertNever(playerState.position);
	}, [playerState, room]);
	const moveToRoomActionCheck = useStaggeredAppearanceActionResult(moveToRoomAction);
	const [exectuteMoveToRoom, processingMoveToRoom] = useWardrobeExecuteChecked(moveToRoomAction, moveToRoomActionCheck);

	return (
		<fieldset>
			<legend>Room ({ room.id })</legend>
			<Column>
				<Row>
					<Button
						slim
						className='fadeDisabled'
						onClick={ exectuteMoveToRoom }
						disabled={ playerState.getCurrentRoomId() === room.id || processingMoveToRoom }
					>
						Move to this room
					</Button>
					<Button
						slim
						className='fadeDisabled'
						onClick={ onSelect }
						disabled={ isSelected }
					>
						Configure this room
					</Button>
				</Row>
				{
					characters.length > 0 ? (
						<div className='character-info'>
							{ characters.map((c) => <SpaceControlCharacter key={ c.id } char={ c } />) }
						</div>
					) : (
						<span>There are no characters in this room</span>
					)
				}
			</Column>
		</fieldset>
	);
}

function SpaceRoomConfig({ room }: {
	room: AssetFrameworkRoomState;
}): ReactElement {
	const [newRoomBackground, setNewRoomBackground] = useState<Immutable<RoomBackgroundConfig> | undefined>(undefined);

	const hasChanges = newRoomBackground !== undefined;
	const applyChangedAction = useMemo((): AppearanceAction => ({
		type: 'spaceConfigure',
		configureAction: {
			type: 'roomConfigure',
			roomId: room.id,
			background: CloneDeepMutable(newRoomBackground),
		},
	}), [room.id, newRoomBackground]);
	const applyChangedCheck = useStaggeredAppearanceActionResult(applyChangedAction);
	const [execute, processing] = useWardrobeExecuteChecked(applyChangedAction, applyChangedCheck);

	const deleteRoomAction = useMemo((): AppearanceAction => ({
		type: 'spaceConfigure',
		configureAction: {
			type: 'roomDelete',
			roomId: room.id,
		},
	}), [room.id]);
	const deleteRoomCheck = useStaggeredAppearanceActionResult(deleteRoomAction);
	const [executeDelete, processingDelete] = useWardrobeExecuteChecked(deleteRoomAction, deleteRoomCheck);

	return (
		<fieldset>
			<legend>Configuration of room <b>{ room.id }</b></legend>
			<Column>
				<Row alignX='end'>
					<Button
						className='fadeDisabled'
						onClick={ executeDelete }
						disabled={ processing || processingDelete }
						slim
					>
						<Row alignY='center' padding='small'>
							<img src={ deleteIcon } alt='Delete room icon' className='filter-invert' />
							Delete this room
						</Row>
					</Button>
				</Row>

				<BackgroundSelector
					value={ newRoomBackground ?? room.background }
					onChange={ setNewRoomBackground }
				/>

				<Button
					className='fadeDisabled'
					onClick={ execute }
					disabled={ !hasChanges || processing || processingDelete }
				>
					Apply changes
				</Button>
			</Column>
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
