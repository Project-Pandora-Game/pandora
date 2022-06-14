import classNames from 'classnames';
import { CharacterId, ICharacterPublicData, IChatRoomMessageChat, IChatRoomStatus, IChatSegment, IsObject } from 'pandora-common';
import { CHAT_ACTIONS, CHAT_ACTIONS_FOLDED_EXTRA } from 'pandora-common/dist/chatroom/chatActions';
import React, {
	ForwardedRef,
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
import { IChatroomMessageActionProcessed, IChatroomMessageProcessed, IsUserMessage, Room, useChatRoomStatus } from '../../character/room';
import { useEvent } from '../../common/useEvent';
import { ShardConnector } from '../../networking/shardConnector';
import { useObservable } from '../../observable';
import { Button } from '../common/Button/Button';
import { ContextMenu, useContextMenu } from '../contextMenu';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ChatParser } from './chatParser';
import './chatroom.scss';
import { COMMAND_KEY, GetCommand, ParseCommands } from './commands';
import { SentMessages } from './sentMessages';

function MessageSend(shardConnector: ShardConnector, message: string): string {
	const text = ParseCommands(shardConnector, message);
	if (typeof text === 'boolean') {
		return text ? '' : message;
	}

	return SentMessages.send(shardConnector, text, ChatParser.parse(text)) ? '' : message;
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
						{roomData.characters.map((c) => <DisplayCharacter key={ c.id } char={ c } />)}
					</ul>
				</div>
			</div>
		</div>
	);
}

function DisplayCharacter({ char }: { char: ICharacterPublicData }): ReactElement {
	const status = useChatRoomStatus(char.id);
	return (
		<li className='character-info'>
			<span>{char.name}</span>
			<span>{char.id} / {char.accountId}</span>
			<Link to='/wardrobe' state={ { character: char.id } }>Wardrobe</Link>
			<span>{status === 'none' ? '' : status}</span>
		</li>
	);
}

const ChatContext = React.createContext<{
	textarea: RefObject<HTMLTextAreaElement>;
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
}>({} as never);

function Chat(): ReactElement | null {
	const messages = useObservable(Room.messages);
	const shardConnector = useShardConnector();
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
			<TextareaInput ref={ textareaRef } />
			<PlayerColorEdit />
		</div>
	);
}

function TextareaInputImpl({ ...props }: React.InputHTMLAttributes<HTMLTextAreaElement>, ref: ForwardedRef<HTMLTextAreaElement>): ReactElement {
	const shardConnector = useShardConnector();
	const lastInput = useRef('');
	const currentTarget = useRef<CharacterId | undefined>();
	const lastStatus = useRef<IChatRoomStatus>('none');
	const timeout = useRef<number>();

	const sendStatus = useEvent((status: IChatRoomStatus) => {
		shardConnector?.sendMessage('chatRoomStatus', { status, target: currentTarget.current });
		lastStatus.current = status;
		Room.setPlayerStatus(status);
	});

	const inputEnd = useEvent(() => {
		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = 0;
		}
		if (lastStatus.current === 'none') {
			return;
		}
		sendStatus('none');
	});

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!shardConnector)
			return;

		const textarea = ev.currentTarget;
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			textarea.value = MessageSend(shardConnector, textarea.value);
		}

		const value = textarea.value;
		if (value === lastInput.current)
			return;

		lastInput.current = value;
		let nextStatus: null | { status: IChatRoomStatus, target?: CharacterId } = null;

		const command = GetCommand(value, (c) => c.requreMessage && c.status !== undefined);
		if (command) {
			if (command === true || !command.status)
				nextStatus = { status: 'none' };
			else if (IsObject(command.status))
				nextStatus = { ...command.status };
			else
				nextStatus = command.status(value.split(/\s+/).slice(1));
		} else if (value.trim().length > 0) {
			nextStatus = { status: 'typing' };
		} else {
			nextStatus = { status: 'none' };
		}

		if (nextStatus.status === 'none') {
			inputEnd();
			return;
		}

		const lastTarget = currentTarget.current;
		currentTarget.current = nextStatus.target;

		if (nextStatus.status !== lastStatus.current || nextStatus.target !== lastTarget) {
			sendStatus(nextStatus.status);
		}

		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = 0;
		}
		timeout.current = setTimeout(() => inputEnd(), 3_000);
	});

	useEffect(() => () => inputEnd(), [inputEnd]);

	return <textarea { ...props } ref={ ref } onKeyDown={ onKeyDown } onBlur={ inputEnd } />;
}

const TextareaInput = React.forwardRef(TextareaInputImpl);

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

function Message({ message }: { message: IChatroomMessageProcessed; }): ReactElement | null {
	if (!IsUserMessage(message)) {
		return <ActionMessage message={ message } />;
	}
	if (message.type === 'deleted') {
		return null;
	}
	return <DisplayUserMessage message={ message } />;
}

function DisplayUserMessage({ message }: { message: IChatRoomMessageChat & { time: number }; }): ReactElement {
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
	const [ref, onContextMenu, close] = useContextMenu();

	const style = message.type === 'me' || message.type === 'emote' ? ({ backgroundColor: message.from.labelColor + '44' }) : undefined;
	const isPrivate = 'to' in message && message.to;
	const self = message.from.id === Player.value?.data?.id;
	return (
		<div className={ classNames('message', message.type, isPrivate && 'private') } style={ style } onContextMenu={ self ? onContextMenu : undefined }>
			{ self ? (
				<ContextMenu ref={ ref }>
					<DisplayContextMenuItems close={ close } id={ message.id } />
				</ContextMenu>
			) : null }
			<DisplayInfo message={ message } />
			{before}
			<DisplayName message={ message } color={ message.from.labelColor } />
			{...message.parts.map((c, i) => RenderChatPart(c, i))}
			{after}
		</div>
	);
}

function DisplayContextMenuItems({ close, id }: { close: () => void; id: number }): ReactElement {
	const timeout = SentMessages.getEditTimeout(id);
	const [edit, setEdit] = useState(timeout !== undefined && timeout > 0);
	const shardConnector = useShardConnector();
	const { textarea } = useContext(ChatContext);

	useEffect(() => {
		if (edit) {
			const timer = setTimeout(() => {
				setEdit(false);
			}, timeout);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [edit, timeout]);

	const elements = useMemo(() => {
		if (!edit)
			return [];

		return [
			<span key='edit' onClick={ () => {
				const message = SentMessages.getMessageForEdit(id);
				if (!message) {
					setEdit(false);
				} else if (textarea.current) {
					textarea.current.value = message;
					textarea.current.focus();
				}
				close();
			} }>
				Edit
			</span>,
			<span key='delete' onClick={ () => {
				SentMessages.delete(shardConnector, id);
				close();
			} }>
				Delete
			</span>,
			<br key='br' />,
		];
	}, [edit, id, textarea, close, shardConnector]);

	return (
		<>
			{elements}
			<span onClick={ () => close() }>Close</span>
		</>
	);
}

function DisplayInfo({ message }: { message: IChatroomMessageProcessed; }): ReactElement {
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

	return (
		<span className='info'>
			{ full
				? <time>{ `${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)}` }</time>
				: <time>{ time.toLocaleTimeString('en-IE').substring(0, 5) }</time> }
			{ message.edited ? <span> [edited]</span> : null }
		</span>
	);
}

function DisplayName({ message, color }: { message: IChatRoomMessageChat; color: string; }): ReactElement | null {
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

	if ('to' in message && message.to) {
		return (
			<span className='name'>
				{before}
				<span className='from' data-id={ message.from.id } onClick={ onClick } style={ style }>{message.from.name}</span>
				{' -> '}
				<span className='to' data-id={ message.to.id } onClick={ onClick } style={ { color: message.to.labelColor } }>{message.to.name}</span>
				{after}
			</span>
		);
	}

	return (
		<span className='name'>
			{before}
			<span className='from' data-id={ message.from.id } onClick={ onClick } style={ style }>{message.from.name}</span>
			{after}
		</span>
	);
}

function ActionMessage({ message }: { message: IChatroomMessageActionProcessed }): ReactElement {
	const [folded, setFolded] = useState(true);

	const [content, extraContent] = useMemo(() => RenderActionContent(message), [message]);

	return (
		<div className={ classNames('message', message.type, extraContent !== null ? 'foldable' : null) } onClick={ () => setFolded(!folded) }>
			<DisplayInfo message={ message } />
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
