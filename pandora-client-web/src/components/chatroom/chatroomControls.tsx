import React, {
	ReactElement, useEffect,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../common/button/button';
import { useChatRoomCharacters, useCharacterState, useChatRoomInfo, useChatroomRequired, IsChatroomAdmin, useActionRoomContext } from '../gameContext/chatRoomContextProvider';
import { usePlayerId, usePlayer, usePlayerState } from '../gameContext/playerContextProvider';
import { useChatInput } from './chatInput';
import { USER_DEBUG } from '../../config/Environment';
import { ChatroomDebugConfigView } from './chatroomDebug';
import { Column, Row } from '../common/container/container';
import { Character, useCharacterData, useCharacterRestrictionManager } from '../../character/character';
import { CharacterRestrictionOverrideWarningContent, useRestrictionOverrideDialogContext, GetRestrictionOverrideText } from '../characterRestrictionOverride/characterRestrictionOverride';
import { DeviceOverlaySetting, DeviceOverlaySettingSchema } from './chatRoomDevice';
import { useObservable } from '../../observable';
import { AssertNotNullable, ICharacterRoomData } from 'pandora-common';
import { Select } from '../common/select/select';
import { ContextHelpButton } from '../help/contextHelpButton';
import { useCurrentAccount } from '../gameContext/directoryConnectorContextProvider';

export function ChatroomControls(): ReactElement | null {
	const roomInfo = useChatRoomInfo().config;
	const roomCharacters = useChatRoomCharacters();
	const navigate = useNavigate();
	const player = usePlayer();

	if (!roomCharacters || !player) {
		return null;
	}

	return (
		<Column padding='medium' className='controls'>
			<Row padding='small'>
				<Button onClick={ () => navigate('/wardrobe', { state: { target: 'room' } }) } >Room inventory</Button>
				<Button onClick={ () => navigate('/chatroom_admin') }>Room administration</Button>
			</Row>
			<br />
			<span>
				These characters are in the room <b>{ roomInfo.name }</b>:
			</span>
			<div className='character-info'>
				<DisplayCharacter char={ player } />
				{
					roomCharacters
						.filter((c) => c !== player)
						.map((c) => <DisplayCharacter key={ c.data.id } char={ c } />)
				}
			</div>
			<br />
			<DeviceOverlaySelector />
			<br />
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

export function PersonalRoomControls(): ReactElement {
	const navigate = useNavigate();
	const player = usePlayer();
	AssertNotNullable(player);

	return (
		<Column padding='medium' className='controls'>
			<span>
				This is { player.name }'s <b>personal room</b>.
				<ContextHelpButton>
					<h3>Personal room</h3>
					<p>
						Every character has their own personal room, which functions as a singleplayer lobby.<br />
						It cannot be deleted or given up. You will automatically end up in this room when your<br />
						selected character is not in any multiplayer room.
					</p>
					<span>
						The personal room functions the same as any other room.<br />
						As no one except you will see whatever you do in this room, it is a great place to experiment!<br />
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
						You can leave the room by joining another room with the "List of chatrooms" button in the "Personal room" tab.
					</p>
					<span>
						<b>Important notes:</b>
						<ul>
							<li>No other characters can join your personal room (not even your account's other characters)</li>
							<li>Restraints will not prevent you from leaving the personal room</li>
							<li>Being in a room device will also not prevent you from leaving the personal room</li>
						</ul>
					</span>
				</ContextHelpButton>
			</span>
			<Row padding='small'>
				<Button slim onClick={ () => navigate('/wardrobe', { state: { target: 'room' } }) } >Room inventory</Button>
			</Row>
			<div className='character-info'>
				<DisplayCharacter char={ player } />
			</div>
			<Row padding='small'>
				<Button onClick={ () => navigate('/chatroom_select') } >List of chatrooms</Button>
			</Row>
			<br />
			<DeviceOverlaySelector />
			<br />
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

export function useRoomConstructionModeCheck() {
	const value = useObservable(DeviceOverlaySetting);
	const currentAccount = useCurrentAccount();
	const chatRoomInfo = useChatRoomInfo();
	const isPlayerAdmin = IsChatroomAdmin(chatRoomInfo.config, currentAccount);
	const { player, playerState } = usePlayerState();
	const room = useActionRoomContext();
	const canUseHands = useCharacterRestrictionManager(player, playerState, room).canUseHands();

	useEffect(() => {
		let nextValue = DeviceOverlaySetting.value;
		if (value.roomId !== chatRoomInfo.id) {
			nextValue = {
				...DeviceOverlaySetting.value,
				roomConstructionMode: false,
				roomId: chatRoomInfo.id,
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
		if (nextValue !== DeviceOverlaySetting.value) {
			DeviceOverlaySetting.value = nextValue;
		}
	}, [value, chatRoomInfo.id, isPlayerAdmin, canUseHands]);
}

function DeviceOverlaySelector(): ReactElement {
	const { roomConstructionMode, defaultView, isPlayerAdmin, canUseHands } = useObservable(DeviceOverlaySetting);

	const onRoomConstructionModeChange = () => {
		DeviceOverlaySetting.value = {
			...DeviceOverlaySetting.value,
			roomConstructionMode: !roomConstructionMode && isPlayerAdmin && canUseHands,
		};
	};

	const onSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		DeviceOverlaySetting.value = DeviceOverlaySettingSchema.parse({
			...DeviceOverlaySetting.value,
			defaultView: e.target.value,
		});
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
					<option value='intractable'>
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

function DisplayCharacter({ char }: { char: Character<ICharacterRoomData>; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const location = useLocation();
	const chatroom = useChatroomRequired();
	const { show: showRestrictionOverrideContext } = useRestrictionOverrideDialogContext();

	const data = useCharacterData(char);
	const state = useCharacterState(chatroom, char.id);
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
						navigate('/wardrobe', { state: { character: data.id } });
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
