import React, {
	ReactElement, useEffect,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/button/button';
import { useSpaceCharacters, useSpaceInfo, IsSpaceAdmin, useActionSpaceContext, useGameState, useGlobalState } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { USER_DEBUG } from '../../../config/Environment';
import { ChatroomDebugConfigView } from './roomDebug';
import { Column, Row } from '../../../components/common/container/container';
import { useCharacterRestrictionManager } from '../../../character/character';
import { DeviceOverlaySetting, DeviceOverlaySettingSchema, DeviceOverlayState } from '../../../graphics/room/roomDevice';
import { useObservable } from '../../../observable';
import { AssertNotNullable } from 'pandora-common';
import { Select } from '../../../components/common/select/select';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { useCurrentAccount } from '../../../components/gameContext/directoryConnectorContextProvider';
import { SpaceControlCharacter } from './spaceControls';
import { WardrobeContextProvider } from '../../../components/wardrobe/wardrobeContext';

export function RoomControls(): ReactElement {
	const characters = useSpaceCharacters();
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const { player, playerState } = usePlayerState();
	const navigate = useNavigate();

	const currentRoom = playerState.getCurrentRoomId();

	return (
		<WardrobeContextProvider target={ { type: 'room', roomId: currentRoom } } player={ player }>
			<Column padding='medium' className='controls'>
				<Row padding='small'>
					<Button onClick={ () => navigate(`/wardrobe/room/${encodeURIComponent(currentRoom)}`) } >Room inventory</Button>
				</Row>
				<br />
				<span>
					These characters are in the current room:
				</span>
				<div className='character-info'>
					<SpaceControlCharacter char={ player } />
					{
						characters
							.filter((c) => {
								if (c === player)
									return false;

								const state = globalState.getCharacterState(c.id);
								if (state == null || state.getCurrentRoomId() !== currentRoom)
									return false;

								return true;
							})
							.map((c) => <SpaceControlCharacter key={ c.data.id } char={ c } />)
					}
				</div>
				<br />
				<DeviceOverlaySelector />
				<br />
				{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
			</Column>
		</WardrobeContextProvider>
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
				<Button slim onClick={ () => navigate('/wardrobe/space-inventory') } >Space inventory</Button>
			</Row>
			<div className='character-info'>
				<SpaceControlCharacter char={ player } />
			</div>
			<Row padding='small'>
				<Button onClick={ () => navigate('/spaces/search') } >List of spaces</Button>
			</Row>
			<br />
			<DeviceOverlaySelector />
			<br />
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

export function useRoomConstructionModeCheck() {
	const value = useObservable(DeviceOverlayState);
	const currentAccount = useCurrentAccount();
	const spaceInfo = useSpaceInfo();
	const isPlayerAdmin = IsSpaceAdmin(spaceInfo.config, currentAccount);
	const { player, playerState } = usePlayerState();
	const spaceContext = useActionSpaceContext();
	const canUseHands = useCharacterRestrictionManager(player, playerState, spaceContext).canUseHands();

	useEffect(() => {
		let nextValue = DeviceOverlayState.value;
		if (value.spaceId !== spaceInfo.id) {
			nextValue = {
				...nextValue,
				roomConstructionMode: false,
				spaceId: spaceInfo.id,
			};
		}
		if (isPlayerAdmin !== value.isPlayerAdmin) {
			nextValue = {
				...nextValue,
				roomConstructionMode: nextValue.roomConstructionMode && isPlayerAdmin,
				isPlayerAdmin,
			};
		}
		if (canUseHands !== value.canUseHands) {
			nextValue = {
				...nextValue,
				roomConstructionMode: nextValue.roomConstructionMode && canUseHands,
				canUseHands,
			};
		}
		DeviceOverlayState.value = nextValue;
	}, [value, spaceInfo.id, isPlayerAdmin, canUseHands]);
}

function DeviceOverlaySelector(): ReactElement {
	const { roomConstructionMode, isPlayerAdmin, canUseHands } = useObservable(DeviceOverlayState);
	const defaultView = useObservable(DeviceOverlaySetting);

	const onRoomConstructionModeChange = () => {
		DeviceOverlayState.value = {
			...DeviceOverlayState.value,
			roomConstructionMode: !roomConstructionMode && isPlayerAdmin && canUseHands,
		};
	};

	const onSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		DeviceOverlaySetting.value = DeviceOverlaySettingSchema.parse(e.target.value);
	};

	return (
		<>
			<Row padding='small' className='room-construction-mode'>
				<Button onClick={ onRoomConstructionModeChange } className='fadeDisabled' disabled={ !isPlayerAdmin || !canUseHands }>
					{ roomConstructionMode ? 'Disable' : 'Enable' } room construction mode
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
			<br />
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
		</>
	);
}
