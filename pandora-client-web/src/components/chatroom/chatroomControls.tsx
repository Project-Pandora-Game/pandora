import React, {
	ReactElement,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/button/button';
import { useChatRoomCharacters, useCharacterState, useChatRoomInfo, useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { usePlayerId } from '../gameContext/playerContextProvider';
import { useChatInput } from './chatInput';
import { USER_DEBUG } from '../../config/Environment';
import { ChatroomDebugConfigView } from './chatroomDebug';
import { Column, Row } from '../common/container/container';
import { Character, useCharacterData } from '../../character/character';
import { CharacterSafemodeWarningContent } from '../characterSafemode/characterSafemode';
import { DeviceOverlayToggle } from './chatRoomDevice';
import { useObservable } from '../../observable';

export function ChatroomControls(): ReactElement | null {
	const roomInfo = useChatRoomInfo();
	const roomCharacters = useChatRoomCharacters();
	const navigate = useNavigate();

	const deviceOverlayToggle = useObservable(DeviceOverlayToggle);

	if (!roomInfo || !roomCharacters) {
		return null;
	}

	return (
		<Column padding='medium' className='controls'>
			<Row padding='small'>
				<Button onClick={ () => navigate('/chatroom_admin') } style={ { marginLeft: '0.5em' } } >Room administration</Button>
				<Button onClick={ () => navigate('/wardrobe', { state: { target: 'room' } }) } >Room inventory</Button>
			</Row>
			<p>You are in room { roomInfo.name }</p>
			<div>
				Characters in this room:<br />
				<ul>
					{ roomCharacters.map((c) => <DisplayCharacter key={ c.data.id } char={ c } />) }
				</ul>
			</div>
			<br />
			<div>
				<label htmlFor='chatroom-device-overlay'>Show device movement area overlay</label>
				<input
					id='chatroom-device-overlay'
					type='checkbox'
					checked={ deviceOverlayToggle }
					onChange={ (e) => DeviceOverlayToggle.value = e.target.checked }
				/>
			</div>
			<br />
			{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
		</Column>
	);
}

function DisplayCharacter({ char }: { char: Character; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();
	const chatroom = useChatroomRequired();

	const data = useCharacterData(char);
	const state = useCharacterState(chatroom, char.id);
	const inSafemode = state?.safemode != null;

	return (
		<li className='character-info'>
			<Column>
				<Row wrap alignY='center'>
					<span onClick={ () => setTarget(data.id) }>{ data.name }</span>
					<span>{ data.id } / { data.accountId }</span>
				</Row>
				{ !inSafemode ? null : (
					<span className='safemode'>
						<CharacterSafemodeWarningContent />
					</span>
				) }
				<Row>
					<Button className='slim' onClick={ () => {
						navigate('/wardrobe', { state: { character: data.id } });
					} }>
						Wardrobe
					</Button>
					{ data.id !== playerId && (
						<Button className='slim' onClick={ () => {
							setTarget(data.id);
						} }>
							Whisper
						</Button>
					) }
				</Row>
			</Column>
		</li>
	);
}
