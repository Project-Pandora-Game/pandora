import React, {
	ReactElement,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../common/button/button';
import { useChatRoomCharacters, useCharacterState, useChatRoomInfo, useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { usePlayerId, usePlayer } from '../gameContext/playerContextProvider';
import { useChatInput } from './chatInput';
import { USER_DEBUG } from '../../config/Environment';
import { ChatroomDebugConfigView } from './chatroomDebug';
import { Column, Row } from '../common/container/container';
import { Character, useCharacterData } from '../../character/character';
import { CharacterSafemodeWarningContent, useSafemodeDialogContext } from '../characterSafemode/characterSafemode';
import { DeviceOverlaySetting, DeviceOverlaySettingSchema } from './chatRoomDevice';
import { useObservable } from '../../observable';
import { ICharacterRoomData } from 'pandora-common';
import { Select } from '../common/select/select';

export function ChatroomControls(): ReactElement | null {
	const roomInfo = useChatRoomInfo();
	const roomCharacters = useChatRoomCharacters();
	const navigate = useNavigate();
	const player = usePlayer();

	const deviceOverlaySetting = useObservable(DeviceOverlaySetting);

	if (!roomInfo || !roomCharacters || !player) {
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
			<div>
				<label htmlFor='chatroom-device-overlay'>Show device movement area overlay</label>
				<Select
					value={ deviceOverlaySetting }
					onChange={ (e) => {
						DeviceOverlaySetting.value = DeviceOverlaySettingSchema.parse(e.target.value);
					} }
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
			<br />
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

function DisplayCharacter({ char }: { char: Character<ICharacterRoomData>; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const location = useLocation();
	const chatroom = useChatroomRequired();
	const safemodeContext = useSafemodeDialogContext();

	const data = useCharacterData(char);
	const state = useCharacterState(chatroom, char.id);
	const inSafemode = state?.safemode != null;
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
				{ !inSafemode ? null : (
					<span className='safemode'>
						<CharacterSafemodeWarningContent />
					</span>
				) }
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
						<Button className='slim' onClick={ () => {
							safemodeContext.show();
						} }>
							{ inSafemode ? 'Exit' : 'Enter' } safemode
						</Button>
					) }
				</Row>
			</Column>
		</fieldset>
	);
}
