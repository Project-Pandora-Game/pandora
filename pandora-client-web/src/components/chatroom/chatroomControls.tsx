import React, {
	ReactElement,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/button/button';
import { useChatRoomCharacters, useCharacterState, useChatRoomInfo, useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { usePlayerId, usePlayer } from '../gameContext/playerContextProvider';
import { useChatInput } from './chatInput';
import { USER_DEBUG } from '../../config/Environment';
import { ChatroomDebugConfigView } from './chatroomDebug';
import { Column, Row } from '../common/container/container';
import { Character, useCharacterData } from '../../character/character';
import { CharacterSafemodeWarningContent, useSafemodeDialogContext } from '../characterSafemode/characterSafemode';
import { DeviceOverlayToggle } from './chatRoomDevice';
import { useObservable } from '../../observable';

export function ChatroomControls(): ReactElement | null {
	const roomInfo = useChatRoomInfo();
	const roomCharacters = useChatRoomCharacters();
	const navigate = useNavigate();
	const player = usePlayer();

	const deviceOverlayToggle = useObservable(DeviceOverlayToggle);

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
	const safemodeContext = useSafemodeDialogContext();

	const data = useCharacterData(char);
	const state = useCharacterState(chatroom, char.id);
	const inSafemode = state?.safemode != null;

	const isPlayer = char.id === playerId;

	return (
		<fieldset>
			<legend className={ char.isPlayer() ? 'player' : '' }>
				<span>
					<span>
						<span style={ { color: data.settings.labelColor } }><b>{ '/// ' }</b></span>
						<span onClick={ () => setTarget(data.id) }><b>{ data.name }</b></span>
						<span> / { data.id } / { data.accountId }</span>
					</span>
				</span>
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
