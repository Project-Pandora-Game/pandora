import type { Immutable } from 'immer';
import { AssertNever, AssertNotNullable, AssetFrameworkRoomState, CloneDeepMutable, GenerateInitialRoomPosition, ICharacterRoomData, ITEM_LIMIT_SPACE_ROOMS, type AppearanceAction, type AssetFrameworkGlobalState, type RoomBackgroundConfig, type RoomId, type RoomName, LIMIT_ROOM_NAME_LENGTH, RoomNameSchema, ZodMatcher } from 'pandora-common';
import React, {
	ReactElement,
	useEffect,
	useId,
	useMemo,
	useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import deleteIcon from '../../../assets/icons/delete.svg';
import { Character } from '../../../character/character';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { useCurrentAccount } from '../../../components/gameContext/directoryConnectorContextProvider';
import { IsSpaceAdmin, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue';
import { WardrobeContextProvider, useWardrobeExecuteChecked } from '../../../components/wardrobe/wardrobeContext';
import { BackgroundSelector } from '../spaceConfiguration/backgroundSelection';
import { SpaceControlCharacter } from './characterControls';

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

	if (selectedRoom != null) {
		return (
			<WardrobeContextProvider target={ { type: 'spaceInventory' } } player={ player }>
				<Column padding='medium' className='controls'>
					<SpaceRoomConfig
						key={ selectedRoom.id }
						room={ selectedRoom }
						close={ () => setSelectedRoomId(null) }
					/>
				</Column>
			</WardrobeContextProvider>
		);
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
			<legend>{ room.name || '[unnamed room]' }</legend>
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

const IsValidRoomName = ZodMatcher(RoomNameSchema);

function SpaceRoomConfig({ room, close }: {
	room: AssetFrameworkRoomState;
	close: () => void;
}): ReactElement {
	const id = useId();

	const [newRoomName, setNewRoomName] = useState<RoomName | undefined>(undefined);
	const [newRoomBackground, setNewRoomBackground] = useState<Immutable<RoomBackgroundConfig> | undefined>(undefined);

	const hasChanges =
		newRoomName !== undefined ||
		newRoomBackground !== undefined;

	const applyChangedAction = useMemo((): AppearanceAction => ({
		type: 'spaceConfigure',
		configureAction: {
			type: 'roomConfigure',
			roomId: room.id,
			name: newRoomName,
			background: CloneDeepMutable(newRoomBackground),
		},
	}), [room.id, newRoomName, newRoomBackground]);
	const applyChangedCheck = useStaggeredAppearanceActionResult(applyChangedAction);
	const [execute, processing] = useWardrobeExecuteChecked(applyChangedAction, applyChangedCheck, {
		onSuccess: close,
	});

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
				<Row alignX='space-between'>
					<Button
						className='fadeDisabled'
						onClick={ close }
						disabled={ processing || processingDelete }
					>
						Discard changes
					</Button>

					<Button
						className='fadeDisabled'
						onClick={ execute }
						disabled={ !hasChanges || processing || processingDelete }
					>
						Apply changes
					</Button>

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

				<Column>
					<label
						htmlFor={ `room-config-${id}-name` }
					>
						Room name ({ (newRoomName ?? room.name).length }/{ LIMIT_ROOM_NAME_LENGTH } characters)
					</label>
					<input
						id={ `room-config-${id}-name` }
						type='text'
						autoComplete='none'
						value={ newRoomName ?? room.name }
						placeholder='[unnamed room]'
						onChange={ (event) => setNewRoomName(event.target.value) }
					/>
					{ newRoomName !== undefined && !IsValidRoomName(newRoomName) ? (<div className='error'>Invalid name</div>) : null }
				</Column>

				<BackgroundSelector
					value={ newRoomBackground ?? room.background }
					onChange={ setNewRoomBackground }
				/>
			</Column>
		</fieldset>
	);
}
