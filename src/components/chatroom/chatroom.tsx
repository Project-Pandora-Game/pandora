import { AssertNever, IChatPart, IChatroomMessageEmote, IEmotePart } from 'pandora-common';
import { CHAT_ACTIONS } from 'pandora-common/dist/chatroom/chatActions';
import React, { KeyboardEvent, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { IChatroomMessageActionProcessed, IChatroomMessageProcessed, Room } from '../../character/room';
import { ShardConnector, SocketIOShardConnector } from '../../networking/socketio_shard_connector';
import { useObservable } from '../../observable';
import { Button } from '../common/Button/Button';
import { useDirectoryConnector } from '../gameContext/gameContextProvider';
import './chatroom.scss';

function MessageSend(connector: SocketIOShardConnector, message: string): void {
	if (!message.trim())
		return;

	if (message.startsWith('*')) {
		let type: IChatroomMessageEmote['type'] = 'me';
		if (message.startsWith('**')) {
			type = 'emote';
			message = message.substring(2);
		} else {
			message = message.substring(1);
		}
		connector.sendMessage('chatRoomMessage', {
			messages: [
				{
					type,
					parts: [
						['contents', message],
					],
				},
			],
		});
		return;
	}
	connector.sendMessage('chatRoomMessage', {
		messages: [
			{
				type: 'chat',
				parts: [
					['contents', message],
				],
			},
		],
	});
}

export function Chatroom(): ReactElement {
	const roomData = useObservable(Room.data);
	const navigate = useNavigate();
	const directoryConnector = useDirectoryConnector();

	if (!roomData) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<div>
			<Button onClick={ () => directoryConnector.sendMessage('chatRoomLeave', {}) }>Leave room</Button>
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
	const [autoScroll, setAutoScroll] = useState(true);
	const messagesDiv = useRef<HTMLDivElement>(null);
	// Needs to be object such that changes don't trigger render
	const scrollingMemo = useMemo(() => ({ isScrolling: false }), []);

	// Only add the smooth scrolling effect after mount and first scroll
	// to make sure there is no visual glitch when switching back into chat screen
	useEffect(() => {
		setTimeout(() => {
			if (messagesDiv.current) {
				messagesDiv.current.style.scrollBehavior = 'smooth';
			}
		}, 0);
	}, []);

	useEffect(() => {
		if (messagesDiv.current && autoScroll) {
			scrollingMemo.isScrolling = true;
			messagesDiv.current.scrollTop = messagesDiv.current.scrollHeight;
		}
	}, [messagesDiv, messages, autoScroll, scrollingMemo]);

	const handleSend = useCallback((ev: KeyboardEvent<HTMLTextAreaElement>) => {
		if (connector && ev.key === 'Enter' && !ev.shiftKey) {
			ev.stopPropagation();
			ev.preventDefault();
			MessageSend(connector, inputValue);
			setInputValue('');
		}
	}, [connector, inputValue]);

	const handleScroll = useCallback((ev: React.UIEvent<HTMLDivElement>) => {
		if (messagesDiv.current && ev.target === messagesDiv.current) {
			// We should scroll to the end if we are either in progress of scrolling or already on the end
			const onEnd = messagesDiv.current.scrollTop + messagesDiv.current.offsetHeight + 1 >= messagesDiv.current.scrollHeight;
			if (onEnd) {
				scrollingMemo.isScrolling = false;
			}
			setAutoScroll(onEnd || scrollingMemo.isScrolling);
		}
	}, [setAutoScroll, messagesDiv, scrollingMemo]);

	if (!connector)
		return null;

	return (
		<div className='chatArea'>
			<div ref={ messagesDiv } onScroll={ handleScroll }>
				{ messages.map((m) => <Message key={ m.time } message={ m } />) }
			</div>
			<textarea value={ inputValue } onChange={ (event) => setInputValue(event.target.value) } onKeyDown={ handleSend } >
			</textarea>
		</div>
	);
}

function RenderChatPart([type, contents]: IChatPart, index: number): string | ReactElement {
	if (type === 'contents') {
		return <React.Fragment key={ index }>{ contents }</React.Fragment>;
	}
	AssertNever(type);
}

function RenderEmotePart([type, contents]: IEmotePart, index: number): string | ReactElement {
	if (type === 'contents') {
		return <React.Fragment key={ index }>{ contents }</React.Fragment>;
	}
	AssertNever(type);
}

function RenderActionContent(action: IChatroomMessageActionProcessed): string {
	let actionText = CHAT_ACTIONS.get(action.id);
	if (actionText === undefined) {
		return `ERROR UNKNOWN ACTION '${action.id}'`;
	}
	if (action.dictionary) {
		const substitutions = Array.from(Object.entries(action.dictionary))
			// Do the longest substitutions first to avoid small one replacing part of large one
			.sort((a, b) => b[0].length - a[0].length);
		for (const [k, v] of substitutions) {
			actionText = actionText.replaceAll(k, v);
		}
	}
	return actionText;
}

function Message({ message }: { message: IChatroomMessageProcessed }): ReactElement {
	if (message.type === 'chat') {
		const name = message.toName !== undefined ? `${message.fromName}->${message.toName}` : message.fromName;
		return (
			<div className={ `message${message.to !== undefined ? ' private' : ''}` }>
				{`${name}: `}
				{ ...message.parts.map(RenderChatPart) }
			</div>
		);
	} else if (message.type === 'emote' || message.type === 'me') {
		return (
			<div className={ `message emote` }>
				*{ message.type === 'me' ? `${message.fromName} ` : '' }
				{ ...message.parts.map(RenderEmotePart) }
				*
			</div>
		);
	} else if (message.type === 'action') {
		return (
			<div className={ `message action` }>
				({RenderActionContent(message)})
			</div>
		);
	}
	AssertNever(message.type);
}
