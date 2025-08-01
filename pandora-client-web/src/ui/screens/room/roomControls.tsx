import { Assert, AssertNotNullable, CHARACTER_SETTINGS_DEFAULT, GenerateInitialRoomPosition, ICharacterRoomData, type AssetFrameworkCharacterState, type AssetFrameworkGlobalState } from 'pandora-common';
import React, {
	ReactElement, useCallback,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import crossIcon from '../../../assets/icons/cross.svg';
import listIcon from '../../../assets/icons/list.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import storageIcon from '../../../assets/icons/storage.svg';
import toolsIcon from '../../../assets/icons/tools.svg';
import { Character, useCharacterData, useCharacterDataMultiple } from '../../../character/character.ts';
import { PlayerCharacter } from '../../../character/player.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { useFriendStatus } from '../../../components/accountContacts/accountContactContext.ts';
import { FRIEND_STATUS_ICONS, FRIEND_STATUS_NAMES } from '../../../components/accountContacts/accountContacts.tsx';
import { CharacterRestrictionOverrideWarningContent, GetRestrictionOverrideText, useRestrictionOverrideDialogContext } from '../../../components/characterRestrictionOverride/characterRestrictionOverride.tsx';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, DivContainer, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { IsSpaceAdmin, useActionSpaceContext, useCharacterState, useGameStateOptional, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer, usePlayerId, usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { ActionTargetToWardrobeUrl } from '../../../components/wardrobe/wardrobeNavigation.tsx';
import { USER_DEBUG } from '../../../config/Environment.ts';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { useObservable } from '../../../observable.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';
import { useChatInput } from '../../components/chat/chatInput.tsx';
import { PrivateRoomTutorialList } from '../../tutorial/privateTutorials.tsx';
import { SpaceStateConfigurationUi } from '../spaceConfiguration/spaceStateConfiguration.tsx';
import { CharacterPreviewGenerationButton } from './characterPreviewGeneration.tsx';
import { useRoomScreenContext } from './roomContext.tsx';
import './roomControls.scss';
import { ChatroomDebugConfigView } from './roomDebug.tsx';
import { DeviceOverlaySetting, DeviceOverlaySettingSchema, DeviceOverlayState, SettingDisplayCharacterName } from './roomState.ts';

export function RoomControls(): ReactElement | null {
	const spaceConfig = useSpaceInfo().config;
	const characters = useSpaceCharacters();
	const player = usePlayer();
	const navigate = useNavigatePandora();
	const gameState = useGameStateOptional();
	const globalState = useGlobalState(gameState);
	const playerState = player != null ? globalState?.getCharacterState(player.id) : null;

	if (globalState == null || !player || playerState == null) {
		return null;
	}

	return (
		<Column padding='medium' className='controls'>
			<Row alignX='space-between'>
				<DivContainer padding='small' direction={ globalState.space.rooms.length > 1 ? 'column' : 'row' }>
					<Button slim onClick={ () => navigate(ActionTargetToWardrobeUrl({ type: 'room', roomId: playerState.currentRoom })) }>
						<img src={ storageIcon } /><span>Room<br />inventory</span>
					</Button>
					<Button slim onClick={ () => navigate('/space/configuration') }>
						<img src={ settingIcon } /><span>Space<br />configuration</span>
					</Button>
				</DivContainer>
				<DisplayRoomsGrid
					player={ player }
					playerState={ playerState }
					characters={ characters }
					globalState={ globalState }
				/>
			</Row>
			&nbsp;
			<SpaceVisibilityWarning />
			<span>
				These characters are in the space <b>{ spaceConfig.name }</b>:
			</span>
			<DisplayRooms
				player={ player }
				playerState={ playerState }
				characters={ characters }
				globalState={ globalState }
			/>
			<DeviceOverlaySelector />
			&nbsp;
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

export function PersonalSpaceControls(): ReactElement {
	const navigate = useNavigatePandora();
	const { globalState, player, playerState } = usePlayerState();
	AssertNotNullable(player);
	const [showBackgrounds, setShowBackgrounds] = useState(false);

	const currentRoomState = globalState.space.getRoom(playerState.currentRoom);
	Assert(currentRoomState != null);

	return (
		<Column padding='medium' className='controls'>
			<span>
				This is { player.name }'s <b>personal space</b>.
				<ContextHelpButton>
					<h3>Personal space</h3>
					<p>
						Every character has their own personal space, which functions as a singleplayer lobby.<br />
						It cannot be deleted or given up. You will automatically end up in this space when your<br />
						selected character is not in any other space.
					</p>
					<span>
						The personal space functions the same as any other space.<br />
						As no one except you will see whatever you do in this space, it is a great place to experiment!<br />
						For example you can:
						<ul className='margin-none'>
							<li>Use the chat or chat commands</li>
							<li>Change your character's clothes or even body in the wardrobe</li>
							<li>Try various character poses and expressions</li>
							<li>Decorate the room freely with room items</li>
							<li><s>Change the room's background</s> - <i>This is not yet possible and will be added in the future</i></li>
						</ul>
					</span>
					<p>
						You can leave the space by joining another space with the "List of spaces" button in the "Personal space" tab.
					</p>
					<span>
						<b>Important notes:</b>
						<ul>
							<li>No other characters can join your personal space (not even your account's other characters)</li>
							<li>Restraints will not prevent you from leaving the personal space</li>
							<li>Being in a room device will also not prevent you from leaving the personal space</li>
						</ul>
					</span>
				</ContextHelpButton>
			</span>
			<Row alignX='space-between'>
				<DivContainer padding='small' direction={ globalState.space.rooms.length > 1 ? 'column' : 'row' }>
					<Button onClick={ () => navigate(ActionTargetToWardrobeUrl({ type: 'room', roomId: playerState.currentRoom })) } >
						<img src={ storageIcon } />Room inventory
					</Button>
					<Button
						onClick={ () => setShowBackgrounds(true) }
					>
						Change space layout
					</Button>
					{
						showBackgrounds ? (
							<ModalDialog className='max-size'>
								<Row alignX='end'>
									<IconButton
										onClick={ () => setShowBackgrounds(false) }
										theme='default'
										src={ crossIcon }
										alt='Close'
										style={ { height: '3em' } }
									/>
								</Row>
								<SpaceStateConfigurationUi
									globalState={ globalState }
								/>
							</ModalDialog>
						) : null
					}
				</DivContainer>
				<DisplayRoomsGrid
					player={ player }
					playerState={ playerState }
					characters={ useMemo(() => [player], [player]) }
					globalState={ globalState }
				/>
			</Row>
			<DisplayRooms
				player={ player }
				playerState={ playerState }
				characters={ useMemo(() => [player], [player]) }
				globalState={ globalState }
			/>
			<Row padding='small'>
				<Button onClick={ () => navigate('/spaces/search') } >
					<img src={ listIcon } />List of spaces
				</Button>
			</Row>
			<Row padding='small'>
				<CharacterPreviewGenerationButton />
			</Row>
			&nbsp;
			<PrivateRoomTutorialList />
			&nbsp;
			<DeviceOverlaySelector />
			&nbsp;
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

function SpaceVisibilityWarning(): ReactElement | null {
	const spaceConfig = useSpaceInfo().config;
	const characters = useSpaceCharacters();
	const characterData = useCharacterDataMultiple(characters);
	const ctx = useActionSpaceContext();

	// Show warning if the space is marked as "public with admin inside", but there is none
	// In all other cases it is either intentionally private or public because of this user
	if (
		spaceConfig.public === 'public-with-admin' &&
		!characterData.some((c) => c.onlineStatus !== 'offline' && ctx.isAdmin(c.accountId))
	) {
		return (
			<span className='space-warning'>
				Note: This space is currently not publicly listed, since no admin is online inside it.
				Users inside can still invite their contacts.
			</span>
		);
	}

	return null;
}

function DeviceOverlaySelector(): ReactElement {
	const { roomConstructionMode, isPlayerAdmin, canUseHands } = useObservable(DeviceOverlayState);
	const defaultView = useObservable(DeviceOverlaySetting);
	const showName = useObservable(SettingDisplayCharacterName);

	const onRoomConstructionModeChange = () => {
		DeviceOverlayState.value = {
			...DeviceOverlayState.value,
			roomConstructionMode: !roomConstructionMode && isPlayerAdmin && canUseHands,
		};
	};

	const onSelectionChange: NonNullable<SelectProps['onChange']> = (e) => {
		DeviceOverlaySetting.value = DeviceOverlaySettingSchema.parse(e.target.value);
	};

	return (
		<>
			<Row padding='small' className='room-construction-mode'>
				<Button onClick={ onRoomConstructionModeChange } disabled={ !isPlayerAdmin || !canUseHands }>
					<img src={ toolsIcon } />&nbsp;{ roomConstructionMode ? 'Disable' : 'Enable' } room construction mode
				</Button>
				{
					!isPlayerAdmin ? (
						<span className='error'>
							You must be an admin to use this feature
						</span>
					) : !canUseHands ? (
						<span className='error'>
							You must be able to use your hands to use this feature
						</span>
					) : null
				}
			</Row>
			&nbsp;
			<div >
				<label htmlFor='chatroom-device-overlay'>Show device movement area overlay</label>
				{ ' ' }
				<Select
					value={ defaultView }
					onChange={ onSelectionChange }
				>
					<option value='never'>
						Never (enterable devices can still be interacted with)
					</option>
					<option value='interactable'>
						For enterable devices only
					</option>
					<option value='always'>
						For all devices
					</option>
				</Select>
			</div>
			<div>
				<label htmlFor='chatroom-character-name-display'>Show name under characters </label>
				<Checkbox
					id='chatroom-character-name-display'
					checked={ showName }
					onChange={ (newValue) => {
						SettingDisplayCharacterName.value = newValue;
					} }
				/>
			</div>
		</>
	);
}

function DisplayRoomsGrid({ playerState, globalState }: {
	player: PlayerCharacter;
	playerState: AssetFrameworkCharacterState;
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
}): ReactElement | null {
	const playerRoom = globalState.space.getRoom(playerState.currentRoom);

	if (globalState.space.rooms.length <= 1 || playerRoom == null)
		return null;

	const { x: centerX, y: centerY } = playerRoom.position;
	const previewSize = 256 * (window.devicePixelRatio || 1);

	return (
		<div className='RoomControlsRoomGrid'>
			{
				[centerY - 1, centerY, centerY + 1].flatMap((y) => [centerX - 1, centerX, centerX + 1].map((x) => {
					const room = globalState.space.rooms.find((r) => r.position.x === x && r.position.y === y);
					if (room == null || (y !== centerY && x !== centerX)) {
						// Filler when there is no room, or for corners
						return (
							<div key={ `${y}:${x}` } />
						);
					} else {
						const previewScale = Math.min(previewSize / room.roomBackground.imageSize[0], previewSize / room.roomBackground.imageSize[1]);
						const previewSizeX = Math.ceil(previewScale * room.roomBackground.imageSize[0]);
						const previewSizeY = Math.ceil(previewScale * room.roomBackground.imageSize[1]);

						return (
							<SelectionIndicator
								key={ room.id }
								selected={ playerState.currentRoom === room.id }
								className='room'
								data-room-id={ room.id }
								align='center'
								justify='center'
							>
								<GameLogicActionButton
									key={ room.id }
									data-room-id={ room.id }
									className='IconButton slim'
									disabled={ playerState.currentRoom === room.id || playerState.position.following != null }
									title={ 'Move to ' + room.name }
									action={ {
										type: 'moveCharacter',
										target: { type: 'character', characterId: playerState.id },
										moveTo: {
											type: 'normal',
											room: room.id,
											position: GenerateInitialRoomPosition(room.roomBackground),
										},
									} }
								>
									<GraphicsSceneBackgroundRenderer
										renderArea={ { x: 0, y: 0, width: previewSizeX, height: previewSizeY } }
										resolution={ 1 }
										backgroundColor={ 0x000000 }
										backgroundAlpha={ 0 }
										forwardContexts={ [serviceManagerContext] }
									>
										<Container
											scale={ { x: previewScale, y: previewScale } }
											x={ (previewSizeX - previewScale * room.roomBackground.imageSize[0]) / 2 }
											y={ (previewSizeY - previewScale * room.roomBackground.imageSize[1]) / 2 }
										>
											<GraphicsBackground
												background={ room.roomBackground } />
										</Container>
									</GraphicsSceneBackgroundRenderer>
									<span className='label'>{ room.name || room.id }</span>
								</GameLogicActionButton>
							</SelectionIndicator>
						);
					}
				}))
			}
		</div>
	);
}

function DisplayRooms({ player, playerState, characters, globalState }: {
	player: PlayerCharacter;
	playerState: AssetFrameworkCharacterState;
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const friends = useFriendStatus();
	const sortedCharacters = useMemo(() => {
		const enum CharOrder {
			PLAYER,
			ONLINE_FRIEND,
			ONLINE,
			FRIEND,
			OFFLINE,
		}

		const getCharOrder = (character: Character<ICharacterRoomData>) => {
			const isPlayer = character.isPlayer();
			const isSameAccount = character.data.accountId === player?.data.accountId;
			const isOnline = character.data.onlineStatus !== 'offline';
			const isFriend = friends.some((friend) => friend.id === character.data.accountId);

			if (isPlayer)
				return CharOrder.PLAYER;

			if (isOnline && (isFriend || isSameAccount))
				return CharOrder.ONLINE_FRIEND;

			if (isOnline)
				return CharOrder.ONLINE;

			if (isFriend || isSameAccount)
				return CharOrder.FRIEND;

			return CharOrder.OFFLINE;
		};

		const charactersSortFunction = (character1: Character<ICharacterRoomData>, character2: Character<ICharacterRoomData>) => {
			return getCharOrder(character1) - getCharOrder(character2);
		};

		return characters.toReversed().sort(charactersSortFunction);
	}, [characters, friends, player?.data.accountId]);

	return (
		<div className='character-info'>
			{
				useMemo(() => {
					const result: ReactElement[] = [];
					const seenCharacters = new Set<Character<ICharacterRoomData>>();

					if (globalState.space.rooms.length > 1) {
						const sortedRooms = globalState.space.rooms.toSorted((a, b) => {
							if ((a.id === playerState.currentRoom) !== (b.id === playerState.currentRoom)) {
								return (a.id === playerState.currentRoom) ? -1 : 1;
							}

							return 0;
						});

						for (const room of sortedRooms) {
							result.push(
								<fieldset key={ room.id } className='room'>
									<legend><span>{ room.name || room.id }</span></legend>
									{
										(room.id !== playerState.currentRoom) ? (
											<Row alignX='end'>
												<GameLogicActionButton
													action={ {
														type: 'moveCharacter',
														target: { type: 'character', characterId: playerState.id },
														moveTo: {
															type: 'normal',
															room: room.id,
															position: GenerateInitialRoomPosition(room.roomBackground),
														},
													} }
													disabled={ playerState.position.following != null }
													className='slim'
												>
													Move to this room
												</GameLogicActionButton>
											</Row>
										) : null
									}
									<Column gap='small'>
										{
											sortedCharacters
												.filter((c) => globalState.getCharacterState(c.id)?.currentRoom === room.id)
												.map((c) => {
													seenCharacters.add(c);
													return (
														<DisplayCharacter
															key={ c.id }
															char={ c }
															globalState={ globalState }
														/>
													);
												})
										}
									</Column>
								</fieldset>,
							);
						}
					}

					const missedCharacters = sortedCharacters.filter((c) => !seenCharacters.has(c));
					for (const c of missedCharacters) {
						result.push(
							<DisplayCharacter
								key={ c.id }
								char={ c }
								globalState={ globalState }
							/>,
						);
					}

					return result;
				}, [globalState, playerState, sortedCharacters])
			}
		</div>
	);
}

function DisplayCharacter({ char, globalState }: {
	char: Character<ICharacterRoomData>;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const spaceInfo = useSpaceInfo();
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigatePandora();
	const location = useLocation();
	const { show: showRestrictionOverrideContext } = useRestrictionOverrideDialogContext();

	const {
		openContextMenu,
	} = useRoomScreenContext();

	const data = useCharacterData(char);
	const state = useCharacterState(globalState, char.id);
	const isAdmin = IsSpaceAdmin(spaceInfo.config, { id: data.accountId });

	const isPlayer = char.isPlayer();
	const playerRoomId = (playerId != null ? globalState.getCharacterState(playerId) : undefined)?.currentRoom ?? null;
	const playerRoom = playerRoomId != null ? globalState.space.getRoom(playerRoomId) : null;

	const icons = useMemo((): ReactNode[] => {
		const result: ReactNode[] = [];
		if (isAdmin) {
			result.push(<img key='space-admin' className='character-icon' src={ shieldIcon } alt='Space admin' title='Space admin' />);
		}
		return result;
	}, [isAdmin]);

	const openMenu = useCallback((event: React.MouseEvent) => {
		openContextMenu(char, {
			x: event.pageX,
			y: event.pageY,
		});
	}, [char, openContextMenu]);

	return (
		<fieldset className='character'>
			<legend className={ char.isPlayer() ? 'player' : '' }>
				<button onClick={ openMenu }>
					<span>
						<span className='colorStrip' style={ { color: data.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } }><b>{ '/// ' }</b></span>
						<span onClick={ () => setTarget(data.id) }><b>{ data.name }</b></span>
						<span> / { data.id } / { data.accountId }</span>
					</span>
				</button>
				{
					icons.length > 0 ? (
						<span>
							{ icons }
						</span>
					) : null
				}
				{
					data.onlineStatus === 'online' ? (
						null // No need to show online status
					) : (
						<span className={ `status status-${data.onlineStatus}` }>
							<img
								className='indicator'
								src={ FRIEND_STATUS_ICONS[data.onlineStatus] }
								alt={ FRIEND_STATUS_NAMES[data.onlineStatus] }
							/>
							{ FRIEND_STATUS_NAMES[data.onlineStatus] }
						</span>
					)
				}
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
					{ (state != null && playerRoom != null && state.currentRoom !== playerRoom.id) ? (
						<GameLogicActionButton
							action={ {
								type: 'moveCharacter',
								target: { type: 'character', characterId: char.id },
								moveTo: {
									type: 'normal',
									room: playerRoom.id,
									position: GenerateInitialRoomPosition(playerRoom.roomBackground),
								},
							} }
							disabled={ state.position.following != null }
							className='slim'
						>
							Move to my current room
						</GameLogicActionButton>
					) : null }
				</Row>
			</Column>
		</fieldset>
	);
}
