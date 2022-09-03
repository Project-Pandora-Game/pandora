import classNames from 'classnames';
import { CharacterId, ICharacterPublicData, IChatRoomMessageChat, IChatSegment } from 'pandora-common';
import { CHAT_ACTIONS, CHAT_ACTIONS_FOLDED_EXTRA } from 'pandora-common/dist/chatroom/chatActions';
import React, {
	ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GetAssetManager } from '../../assets/assetManager';
import { useEvent } from '../../common/useEvent';
import { Button } from '../common/Button/Button';
import { ContextMenu, useContextMenu } from '../contextMenu';
import { IChatroomMessageActionProcessed, IChatroomMessageProcessed, IsUserMessage, useChatRoomData, useChatRoomMessages, useChatRoomMessageSender } from '../gameContext/chatRoomContextProvider';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useNotification, NotificationSource } from '../gameContext/notificationContextProvider';
import { usePlayerData, usePlayerId } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ChatInputArea, ChatInputContextProvider, useChatInput } from './chatInput';
import { ChatParser } from './chatParser';
import './chatroom.scss';

export function Chatroom(): ReactElement {
	const roomData = useChatRoomData();
	const navigate = useNavigate();
	const directoryConnector = useDirectoryConnector();

	if (!roomData) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<div className='chatroom'>
			<ChatInputContextProvider>
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
			</ChatInputContextProvider>
		</div>
	);
}

function DisplayCharacter({ char }: { char: ICharacterPublicData }): ReactElement {
	const { setTarget } = useChatInput();

	return (
		<li className='character-info'>
			<span onClick={ () => setTarget(char.id) }>{char.name}</span>
			<span>{char.id} / {char.accountId}</span>
			<Link to='/wardrobe' state={ { character: char.id } }>Wardrobe</Link>
		</li>
	);
}

function Chat(): ReactElement | null {
	const messages = useChatRoomMessages();
	const shardConnector = useShardConnector();
	const [autoScroll, setAutoScroll] = useState(true);
	const messagesDiv = useRef<HTMLDivElement>(null);
	const lastMessageCount = useRef(0);
	// Needs to be object such that changes don't trigger render
	const scrollingMemo = useMemo(() => ({ isScrolling: false }), []);

	const { supress, unsupress, clear } = useNotification(NotificationSource.CHAT_MESSAGE);

	// Only add the smooth scrolling effect after mount and first scroll
	// to make sure there is no visual glitch when switching back into chat screen
	useEffect(() => {
		setTimeout(() => {
			if (messagesDiv.current) {
				messagesDiv.current.style.scrollBehavior = 'smooth';
			}
		}, 0);
	}, []);

	const scroll = useEvent(() => {
		if (messagesDiv.current && autoScroll) {
			scrollingMemo.isScrolling = true;
			messagesDiv.current.scrollTop = messagesDiv.current.scrollHeight;
		}
	});

	useEffect(() => {
		scroll();
	}, [messages, scroll]);

	useEffect(() => {
		if (scrollingMemo.isScrolling && document.visibilityState === 'visible') {
			supress();
			clear();
		}
		return () => unsupress();
	}, [messages, scrollingMemo, lastMessageCount, clear, supress, unsupress]);

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
			<div className='messages' ref={ messagesDiv } onScroll={ handleScroll } tabIndex={ 1 }>
				{messages.map((m) => <Message key={ m.time } message={ m } />)}
			</div>
			<ChatInputArea messagesDiv={ messagesDiv } scroll={ scroll } />
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

function GetActiontext(action: IChatroomMessageActionProcessed): string | undefined {
	const assetManager = GetAssetManager();
	const item = action.data?.item;
	const asset = item && assetManager.getAssetById(item.assetId);
	const itemPrevious = action.data?.itemPrevious ?? item;
	const assetPrevious = itemPrevious && assetManager.getAssetById(itemPrevious.assetId);

	const defaultMessage = CHAT_ACTIONS.get(action.id);

	// Asset-specific message overrides
	switch (action.id) {
		case 'itemAdd':
			return asset?.definition.actionMessages?.itemAdd ?? defaultMessage;
		case 'itemRemove':
			return assetPrevious?.definition.actionMessages?.itemRemove ?? defaultMessage;
	}

	return defaultMessage;
}

function RenderActionContent(action: IChatroomMessageActionProcessed): [IChatSegment[], IChatSegment[] | null] {
	let actionText = GetActiontext(action);
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
	const playerId = usePlayerId();

	const style = message.type === 'me' || message.type === 'emote' ? ({ backgroundColor: message.from.labelColor + '44' }) : undefined;
	const isPrivate = 'to' in message && message.to;
	const self = message.from.id === playerId;
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
	const sender = useChatRoomMessageSender();
	const timeout = sender.getMessageEditTimeout(id);
	const [edit, setEdit] = useState(timeout !== undefined && timeout > 0);
	const { setEditing } = useChatInput();

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
				if (!setEditing(id)) {
					setEdit(false);
				}
				close();
			} }>
				Edit
			</span>,
			<span key='delete' onClick={ () => {
				try {
					sender.deleteMessage(id);
				} catch {
					setEdit(false);
				}
				close();
			} }>
				Delete
			</span>,
			<br key='br' />,
		];
	}, [edit, id, close, sender, setEditing]);

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
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();

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

	const onClick = useCallback((event: React.MouseEvent<HTMLSpanElement>) => {
		event.stopPropagation();

		const id = event.currentTarget.getAttribute('data-id');
		if (!id || id === playerId)
			return;

		setTarget(id as CharacterId);
	}, [setTarget, playerId]);

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

function ActionMessage({ message }: { message: IChatroomMessageActionProcessed }): ReactElement | null {
	const [folded, setFolded] = useState(true);

	const [content, extraContent] = useMemo(() => RenderActionContent(message), [message]);

	// If there is nothing to disply, hide this message
	if (!content && !extraContent)
		return null;

	const style = message.type === 'action' && message.data?.character ? ({ backgroundColor: message.data.character.labelColor + '44' }) : undefined;

	return (
		<div className={ classNames('message', message.type, extraContent !== null ? 'foldable' : null) } style={ style } onClick={ () => setFolded(!folded) }>
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
