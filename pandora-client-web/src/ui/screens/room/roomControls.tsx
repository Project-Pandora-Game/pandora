import { AssertNotNullable, ICharacterRoomData } from 'pandora-common';
import React, {
	ReactElement, useCallback,
	useMemo,
	type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import listIcon from '../../../assets/icons/list.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import storageIcon from '../../../assets/icons/storage.svg';
import toolsIcon from '../../../assets/icons/tools.svg';
import { Character, useCharacterData, useCharacterDataMultiple } from '../../../character/character';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select';
import { useFriendStatus } from '../../../components/accountContacts/accountContactContext';
import { CharacterRestrictionOverrideWarningContent, GetRestrictionOverrideText, useRestrictionOverrideDialogContext } from '../../../components/characterRestrictionOverride/characterRestrictionOverride';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { IsSpaceAdmin, useActionSpaceContext, useCharacterState, useGameState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerId } from '../../../components/gameContext/playerContextProvider';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { USER_DEBUG } from '../../../config/Environment';
import { SettingDisplayCharacterName } from '../../../graphics/room/roomCharacter';
import { DeviceOverlaySetting, DeviceOverlaySettingSchema, DeviceOverlayState } from '../../../graphics/room/roomDevice';
import { useObservable } from '../../../observable';
import { useChatInput } from '../../components/chat/chatInput';
import { PrivateRoomTutorialList } from '../../tutorial/privateTutorials';
import { useRoomScreenContext } from './roomContext';
import { ChatroomDebugConfigView } from './roomDebug';

export function RoomControls(): ReactElement | null {
	const spaceConfig = useSpaceInfo().config;
	const characters = useSpaceCharacters();
	const player = usePlayer();
	const navigate = useNavigate();

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
			const isOnline = character.data.isOnline;
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

	if (!characters || !player) {
		return null;
	}

	return (
		<Column padding='medium' className='controls'>
			<Row padding='small'>
				<Button className='inverseColor' onClick={ () => navigate('/wardrobe/room-inventory') } >
					<img src={ storageIcon } />Room inventory
				</Button>
				<Button className='inverseColor' onClick={ () => navigate('/space/configuration') }>
					<img src={ settingIcon } />Space configuration
				</Button>
			</Row>
			&nbsp;
			<SpaceVisibilityWarning />
			<span>
				These characters are in the space <b>{ spaceConfig.name }</b>:
			</span>
			<div className='character-info'>
				{
					sortedCharacters
						.map((c) => <DisplayCharacter key={ c.data.id } char={ c } />)
				}
			</div>
			<DeviceOverlaySelector />
			&nbsp;
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

export function PersonalSpaceControls(): ReactElement {
	const navigate = useNavigate();
	const player = usePlayer();
	AssertNotNullable(player);

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
			<Row padding='small'>
				<Button className='inverseColor' onClick={ () => navigate('/wardrobe/room-inventory') } >
					<img src={ storageIcon } />Room inventory
				</Button>
			</Row>
			<div className='character-info'>
				<DisplayCharacter char={ player } />
			</div>
			<Row padding='small'>
				<Button onClick={ () => navigate('/spaces/search') } >
					<img src={ listIcon } />List of spaces
				</Button>
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
		!characterData.some((c) => c.isOnline && ctx.isAdmin(c.accountId))
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
				<Button onClick={ onRoomConstructionModeChange } className='inverseColor' disabled={ !isPlayerAdmin || !canUseHands }>
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

function DisplayCharacter({ char }: { char: Character<ICharacterRoomData>; }): ReactElement {
	const spaceInfo = useSpaceInfo();
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const location = useLocation();
	const gameState = useGameState();
	const { show: showRestrictionOverrideContext } = useRestrictionOverrideDialogContext();

	const {
		openContextMenu,
	} = useRoomScreenContext();

	const data = useCharacterData(char);
	const state = useCharacterState(gameState, char.id);
	const isOnline = data.isOnline;
	const isAdmin = IsSpaceAdmin(spaceInfo.config, { id: data.accountId });

	const isPlayer = char.id === playerId;

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
		<fieldset>
			<legend className={ char.isPlayer() ? 'player' : '' }>
				<button onClick={ openMenu }>
					<span>
						<span className='colorStrip' style={ { color: data.settings.labelColor } }><b>{ '/// ' }</b></span>
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
