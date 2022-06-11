import classNames from 'classnames';
import { CharacterId, IChatSegment } from 'pandora-common';
import { CHAT_ACTIONS, CHAT_ACTIONS_FOLDED_EXTRA } from 'pandora-common/dist/chatroom/chatActions';
import React, {
	KeyboardEvent,
	ReactElement,
	RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Player, usePlayerData } from '../../character/player';
import { IChatroomMessageActionProcessed, IChatroomMessageProcessed, IsUserMessage, Room } from '../../character/room';
import { ShardConnector } from '../../networking/shardConnector';
import { useObservable } from '../../observable';
import { Button } from '../common/Button/Button';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ChatParser } from './chatParser';
import './chatroom.scss';
import { COMMAND_KEY, ParseCommands } from './commands';

function MessageSend(shardConnector: ShardConnector, message: string): string {
	const text = ParseCommands(shardConnector, message);
	if (typeof text === 'boolean') {
		return text ? '' : message;
	}

	const messages = ChatParser.parse(text);

	if (messages.length === 0) {
		return message;
	}

	shardConnector.sendMessage('chatRoomMessage', { messages });
	return '';
}

export function Chatroom(): ReactElement {
	const roomData = useObservable(Room.data);
	const navigate = useNavigate();
	const directoryConnector = useDirectoryConnector();

	if (!roomData) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<div className='chatroom'>
			<Chat />
			<div>
				<Button onClick={ () => directoryConnector.sendMessage('chatRoomLeave', {}) }>Leave room</Button>
				<Button onClick={ () => navigate('/chatroom_admin') } style={ { marginLeft: '0.5em' } } >Room administration</Button>
				<br />
				<p>You are in room {roomData.name}</p>
				<div>
					Characters in this room:<br />
					<ul>
						{roomData.characters.map((c) => (
							<li key={ c.id }>
								{`${c.name} (${c.id}/${c.accountId})`}
								<Link to='/wardrobe' state={ { character: c.id } }>Wardrobe</Link>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

const ChatContext = React.createContext<{
	textarea: RefObject<HTMLTextAreaElement>;
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
}>({} as never);

function Chat(): ReactElement | null {
	const messages = useObservable(Room.messages);
	const shardConnector = useShardConnector();
	const [inputValue, setInputValue] = useState('');
	const [autoScroll, setAutoScroll] = useState(true);
	const messagesDiv = useRef<HTMLDivElement>(null);
	// Needs to be object such that changes don't trigger render
	const scrollingMemo = useMemo(() => ({ isScrolling: false }), []);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const context = useMemo(() => ({
		textarea: textareaRef,
	}), []);

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
		if (shardConnector && ev.key === 'Enter' && !ev.shiftKey) {
			ev.stopPropagation();
			ev.preventDefault();
			setInputValue(MessageSend(shardConnector, inputValue));
		}
	}, [shardConnector, inputValue]);

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

	if (!shardConnector)
		return null;

	return (
		<div className='chatArea'>
			<ChatContext.Provider value={ context }>
				<div className='messages' ref={ messagesDiv } onScroll={ handleScroll }>
					{messages.map((m) => <Message key={ m.time } message={ m } />)}
				</div>
			</ChatContext.Provider>
			<textarea
				ref={ textareaRef }
				value={ inputValue }
				onChange={ (event) => setInputValue(event.target.value) }
				onKeyDown={ handleSend } />
			<PlayerColorEdit />
		</div>
	);
}

function RenderChatPart([type, contents]: IChatSegment, index: number): ReactElement {
	switch (type) {
		case 'normal':
			return <span key={ index }>{contents}</span>;
		case 'italic':
			return <em key={ index }>{contents}</em>;
		case 'bold':
			return <strong key={ index }>{contents}</strong>;
	}
}

function RenderActionContent(action: IChatroomMessageActionProcessed): [IChatSegment[], IChatSegment[] | null] {
	let actionText = CHAT_ACTIONS.get(action.id);
	if (actionText === undefined) {
		return [ChatParser.parseStyle(`( ERROR UNKNOWN ACTION '${action.id}' )`), null];
	}
	// Server messages can have extra info
	let actionExtraText = action.type === 'serverMessage' ? CHAT_ACTIONS_FOLDED_EXTRA.get(action.id) : undefined;
	if (action.dictionary) {
		const substitutions = Array.from(Object.entries(action.dictionary))
			// Do the longest substitutions first to avoid small one replacing part of large one
			.sort((a, b) => b[0].length - a[0].length);
		for (const [k, v] of substitutions) {
			actionText = actionText.replaceAll(k, v);
			if (actionExtraText !== undefined) {
				actionExtraText = actionExtraText.replaceAll(k, v);
			}
		}
	}
	if (action.type === 'action') {
		actionText = `(${actionText})`;
	}
	return [ChatParser.parseStyle(actionText), actionExtraText ? ChatParser.parseStyle(actionExtraText) : null];
}

const LABEL_COLOR_FALLBACK = new Map<CharacterId, string>();
function GetLabelColor(id: CharacterId): string {
	const color = Room.getCharacterSettings(id)?.labelColor;
	if (color === undefined) {
		return LABEL_COLOR_FALLBACK.get(id) ?? '#ffffff';
	} else {
		LABEL_COLOR_FALLBACK.set(id, color);
	}
	return color;
}

function Message({ message }: { message: IChatroomMessageProcessed; }): ReactElement {
	const [before, after] = useMemo(() => {
		switch (message.type) {
			case 'ooc':
				return ['', ' ))'];
			case 'emote':
			case 'me':
				return ['*', '*'];
			default:
				return ['', ''];
		}
	}, [message.type]);

	if (!IsUserMessage(message)) {
		return <ActionMessage message={ message } />;
	}

	const color = GetLabelColor(message.from);
	const style = message.type === 'me' || message.type === 'emote' ? ({ backgroundColor: color + '44' }) : undefined;
	const isPrivate = 'to' in message && message.to;
	return (
		<div className={ classNames('message', message.type, isPrivate && 'private') } style={ style }>
			<DisplayTime message={ message } />
			{before}
			<DisplayName message={ message } color={ color } />
			{...message.parts.map((c, i) => RenderChatPart(c, i))}
			{after}
		</div>
	);
}

function DisplayTime({ message }: { message: IChatroomMessageProcessed; }): ReactElement {
	const time = useMemo(() => new Date(message.time), [message.time]);
	const [full, setFull] = useState(new Date().getDate() !== time.getDate());

	useEffect(() => {
		if (full)
			return;

		const now = new Date();
		const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		const cleanup = setTimeout(() => {
			setFull(true);
		}, tomorrow.getTime() - now.getTime());
		return () => clearTimeout(cleanup);
	}, [message.time, full]);

	if (full) {
		return <time>{ `${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)}` }</time>;
	}

	return <time>{ `${time.toLocaleTimeString('en-IE').substring(0, 5)}` }</time>;
}

function DisplayName({ message, color }: { message: IChatroomMessageProcessed; color: string; }): ReactElement | null {
	const { textarea } = useContext(ChatContext);

	const [before, after] = useMemo(() => {
		switch (message.type) {
			case 'ooc':
				return ['[OOC] ', ': (( '];
			case 'chat':
				return ['', ': '];
			case 'me':
				return ['', ' '];
			default:
				return ['', ''];
		}
	}, [message.type]);

	if (!IsUserMessage(message))
		return null;

	const onClick = (event: React.MouseEvent<HTMLSpanElement>) => {
		event.stopPropagation();
		if (!textarea.current)
			return;

		const id = event.currentTarget.getAttribute('data-id');
		if (!id || id === Player.value?.data.id)
			return;

		const text = textarea.current.value.trimStart();
		if (!text.startsWith(COMMAND_KEY)) {
			textarea.current.value = `/w ${id} ${text}`;
			return;
		}

		const [, command, next] = /([^\s]+)\s+[^s]+\s+(.*)/s.exec(text) ?? [];
		if (command === (COMMAND_KEY + 'w') || command === (COMMAND_KEY + 'whisper')) {
			textarea.current.value = `${command} ${id} ${next}`;
		}
	};

	const style = message.type !== 'me' && message.type !== 'emote' ? ({ color }) : undefined;

	if ('to' in message && 'toName' in message && message.to) {
		return (
			<span className='name'>
				{before}
				<span className='from' data-id={ message.from } onClick={ onClick } style={ style }>{message.fromName}</span>
				{' -> '}
				<span className='to' data-id={ message.to } onClick={ onClick } style={ { color: GetLabelColor(message.to) } }>{message.toName}</span>
				{after}
			</span>
		);
	}

	return (
		<span className='name'>
			{before}
			<span className='from' data-id={ message.from } onClick={ onClick } style={ style }>{message.fromName}</span>
			{after}
		</span>
	);
}

function ActionMessage({ message }: { message: IChatroomMessageActionProcessed }): ReactElement {
	const [folded, setFolded] = useState(true);

	const [content, extraContent] = useMemo(() => RenderActionContent(message), [message]);

	return (
		<div className={ classNames('message', message.type, extraContent !== null ? 'foldable' : null) } onClick={ () => setFolded(!folded) }>
			<DisplayTime message={ message } />
			{ extraContent != null ? (folded ? '\u25ba ' : '\u25bc ') : null }
			{ content?.map((c, i) => RenderChatPart(c, i)) }
			{ extraContent != null && folded ? ' ( ... )' : null }
			{
				!folded && extraContent != null && (
					<>
						<br />
						{ extraContent.map((c, i) => RenderChatPart(c, i)) }
					</>
				)
			}
		</div>
	);
}

function PlayerColorEdit() {
	const data = usePlayerData();
	const [color, setColor] = useState(data?.settings.labelColor ?? '#ffffff');
	const shardConnector = useShardConnector();

	if (!data)
		return null;

	return (
		<div className='input-line'>
			<label>Color</label>
			<input type='color' value={ color } onChange={ (event) => setColor(event.target.value) } />
			<Button className='slim' onClick={ () => shardConnector?.sendMessage('updateSettings', { labelColor: color }) }>Save</Button>
		</div>
	);
}
