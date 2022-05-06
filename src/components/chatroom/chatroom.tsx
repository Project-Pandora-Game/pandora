import React, { KeyboardEvent, ReactElement, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../common/Button/Button';
import { useObservable } from '../../observable';
import { IChatRoomMessageSaved, Room } from '../../character/room';
import { DirectoryConnector } from '../../networking/socketio_directory_connector';
import './chatroom.scss';
import { ShardConnector } from '../../networking/socketio_shard_connector';

export function Chatroom(): ReactElement {
	const roomData = useObservable(Room.data);
	const navigate = useNavigate();

	if (!roomData) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<div>
			<Button onClick={ ChatroomLeave }>Leave room</Button>
			<Button onClick={ () => navigate('/chatroom_admin') } style={ { marginLeft: '0.5em' } } >Room administration</Button>
			<br />
			<p>You are in room { roomData.name }</p>
			<div>
				Characters in this room:<br />
				<ul>
					{ roomData.characters.map((c) => (
						<li key={ c.id }>
							{`${c.name} (${c.id}/${c.accountId})`}
							<Link to='/wardrobe' state={ { character: c.id } }>Wardrobe</Link>
						</li>
					)) }
				</ul>
			</div>
			Actual chat:<br />
			<Chat />
		</div>
	);
}

function Chat(): ReactElement | null {
	const messages = useObservable(Room.messages);
	const connector = useObservable(ShardConnector);
	const [inputValue, setInputValue] = useState('');

	if (!connector)
		return null;

	const handleSend = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.stopPropagation();
			ev.preventDefault();
			connector.sendMessage('chatRoomMessage', { message: inputValue });
			setInputValue('');
		}
	};

	return (
		<div className='chatArea'>
			<div>
				{ messages.map((m) => <Message key={ m.id } message={ m } />) }
			</div>
			<textarea value={ inputValue } onChange={ (event) => setInputValue(event.target.value) } onKeyDown={ handleSend } >
			</textarea>
		</div>
	);
}

function Message({ message }: { message: IChatRoomMessageSaved }): ReactElement {
	return (
		<div className={ `message${message.private ? ' private' : ''}` }>
			{`${message.fromName}: ${message.message}`}
		</div>
	);
}

function ChatroomLeave(): void {
	DirectoryConnector.sendMessage('chatRoomLeave', {});
}
