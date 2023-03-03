import classNames from 'classnames';
import { CharacterId, IChatRoomMessageChat, IChatSegment, MessageSubstitute, RoomId } from 'pandora-common';
import { CHAT_ACTIONS, CHAT_ACTIONS_FOLDED_EXTRA } from 'pandora-common/dist/chatroom/chatActions';
import React, {
	memo,
	ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GetAssetManager } from '../../assets/assetManager';
import { Button } from '../common/button/button';
import { TabContainer, Tab } from '../common/tabs/tabs';
import { ContextMenu, useContextMenu } from '../contextMenu';
import { IChatroomMessageActionProcessed, IChatroomMessageProcessed, IsUserMessage, useChatroom, useChatRoomMessages, useChatRoomMessageSender } from '../gameContext/chatRoomContextProvider';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useNotification, NotificationSource } from '../gameContext/notificationContextProvider';
import { usePlayer, usePlayerId } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ChatInputArea, ChatInputContextProvider, useChatInput } from './chatInput';
import { ChatParser } from './chatParser';
import { ChatRoomScene } from './chatRoomScene';
import './chatroom.scss';
import { WardrobeContextProvider, WardrobeExpressionGui, WardrobePoseGui } from '../wardrobe/wardrobe';
import { USER_DEBUG } from '../../config/Environment';
import { ChatroomDebugConfigView } from './chatroomDebug';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { useAutoScroll } from '../../common/useAutoScroll';
import { Row } from '../common/container/container';
import { useDocumentVisibility } from '../../common/useDocumentVisibility';
import { useNullableObservable } from '../../observable';
import { Character, useCharacterData, useCharacterSafemode } from '../../character/character';
import { CharacterSafemodeWarningContent } from '../characterSafemode/characterSafemode';

export function Chatroom(): ReactElement {
	const player = usePlayer();
	const room = useChatroom();
	const roomData = useNullableObservable(room?.data);
	const roomCharacters = useNullableObservable(room?.characters);
	const navigate = useNavigate();
	const directoryConnector = useDirectoryConnector();

	if (!room || !roomData || !roomCharacters || !player) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<div className='chatroom'>
			<ChatInputContextProvider>
				<ChatRoomScene />
				<TabContainer collapsable={ true }>
					<Tab name='Chat'>
						<Chat />
					</Tab>
					<Tab name='Controls'>
						<div className='controls'>
							<Button onClick={ () => directoryConnector.sendMessage('chatRoomLeave', {}) }>Leave room</Button>
							<Button onClick={ () => navigate('/chatroom_admin') } style={ { marginLeft: '0.5em' } } >Room administration</Button>
							<br />
							<p>You are in room { roomData.name }</p>
							<div>
								Characters in this room:<br />
								<ul>
									{ roomCharacters.map((c) => <DisplayCharacter key={ c.data.id } char={ c } />) }
								</ul>
							</div>
							{ USER_DEBUG ? <ChatroomDebugConfigView /> : null }
						</div>
					</Tab>
					<Tab name='Pose'>
						<WardrobeContextProvider player={ player } character={ player }>
							<WardrobePoseGui />
						</WardrobeContextProvider>
					</Tab>
					<Tab name='Expressions'>
						<WardrobeContextProvider player={ player } character={ player }>
							<WardrobeExpressionGui />
						</WardrobeContextProvider>
					</Tab>
				</TabContainer>
			</ChatInputContextProvider>
		</div>
	);
}

function DisplayCharacter({ char }: { char: Character; }): ReactElement {
	const playerId = usePlayerId();
	const { setTarget } = useChatInput();
	const navigate = useNavigate();

	const data = useCharacterData(char);
	const inSafemode = useCharacterSafemode(char) != null;

	return (
		<li className='character-info'>
			<span onClick={ () => setTarget(data.id) }>{ data.name }</span>
			<span>{ data.id } / { data.accountId }</span>
			{ !inSafemode ? null : (
				<span className='safemode'>
					<CharacterSafemodeWarningContent />
				</span>
			) }
			<br />
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
		</li>
	);
}

function Chat(): ReactElement | null {
	const messages = useChatRoomMessages();
	const shardConnector = useShardConnector();
	const [messagesDiv, scroll, isScrolling] = useAutoScroll<HTMLDivElement>([messages]);
	const lastMessageCount = useRef(0);
	let newMessageCount = 0;

	const { supress, unsupress, clear } = useNotification(NotificationSource.CHAT_MESSAGE);
	const visible = useDocumentVisibility();

	useEffect(() => {
		if (isScrolling && visible) {
			supress();
			clear();
		}
		return () => unsupress();
	}, [messages, isScrolling, lastMessageCount, clear, supress, unsupress, visible]);

	const playerId = usePlayerId();

	if (!shardConnector)
		return null;

	if (!isScrolling) {
		newMessageCount = messages.length - lastMessageCount.current;
	} else {
		lastMessageCount.current = messages.length;
	}

	return (
		<div className='chatArea'>
			<Scrollbar color='dark' className='messages' ref={ messagesDiv } tabIndex={ 1 }>
				{ messages.map((m) => <Message key={ m.time } message={ m } playerId={ playerId } />) }
			</Scrollbar>
			<ChatInputArea messagesDiv={ messagesDiv } scroll={ scroll } newMessageCount={ newMessageCount } />
		</div>
	);
}

export function RenderChatPart([type, contents]: IChatSegment, index: number): ReactElement {
	switch (type) {
		case 'normal':
			return <span key={ index }>{ contents }</span>;
		case 'italic':
			return <em key={ index }>{ contents }</em>;
		case 'bold':
			return <strong key={ index }>{ contents }</strong>;
	}
}

function GetActiontext(action: IChatroomMessageActionProcessed): string | undefined {
	if (action.customText != null)
		return action.customText;

	const assetManager = GetAssetManager();
	const item = action.data?.item;
	const asset = item && assetManager.getAssetById(item.assetId);
	const itemPrevious = action.data?.itemPrevious ?? item;
	const assetPrevious = itemPrevious && assetManager.getAssetById(itemPrevious.assetId);

	const defaultMessage = CHAT_ACTIONS.get(action.id);

	// Asset-specific message overrides
	switch (action.id) {
		case 'itemAdd':
			return asset?.definition.chat?.actionAdd ?? defaultMessage;
		case 'itemRemove':
			return assetPrevious?.definition.chat?.actionRemove ?? defaultMessage;
		case 'itemAttach':
			return asset?.definition.chat?.actionAttach ?? defaultMessage;
		case 'itemDetach':
			return assetPrevious?.definition.chat?.actionDetach ?? defaultMessage;
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
		actionText = MessageSubstitute(actionText, action.dictionary);
		if (actionExtraText !== undefined) {
			actionExtraText = MessageSubstitute(actionExtraText, action.dictionary);
		}
	}
	if (action.type === 'action' && actionText) {
		actionText = `(${actionText})`;
	}
	return [ChatParser.parseStyle(actionText), actionExtraText ? ChatParser.parseStyle(actionExtraText) : null];
}

function ChatroomMessageEquals(a: IChatroomMessageProcessed, b: IChatroomMessageProcessed): boolean {
	return a.time === b.time && a.edited === b.edited && a.roomId === b.roomId;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const Message = memo(function Message({ message, playerId }: { message: IChatroomMessageProcessed; playerId: CharacterId | null; }): ReactElement | null {
	if (!IsUserMessage(message)) {
		return <ActionMessage message={ message } />;
	}
	if (message.type === 'deleted') {
		return null;
	}
	return <DisplayUserMessage message={ message } playerId={ playerId } />;
}, (prev, next) => {
	return ChatroomMessageEquals(prev.message, next.message) && prev.playerId === next.playerId;
});

function DisplayUserMessage({ message, playerId }: { message: IChatRoomMessageChat & { time: number; roomId: RoomId; }; playerId: CharacterId | null; }): ReactElement {
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
	const self = message.from.id === playerId;
	return (
		<>
			<div className={ classNames('message', message.type, isPrivate && 'private') } style={ style } onContextMenu={ self ? onContextMenu : undefined }>
				<DisplayInfo message={ message } />
				{ before }
				<DisplayName message={ message } color={ message.from.labelColor } />
				{...message.parts.map((c, i) => RenderChatPart(c, i))}
				{ after }
			</div>
			{ self ? (
				<ContextMenu ref={ ref } className='opaque'>
					<DisplayContextMenuItems close={ close } id={ message.id } />
				</ContextMenu>
			) : null }
		</>
	);
}

function DisplayContextMenuItems({ close, id }: { close: () => void; id: number; }): ReactElement {
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
			<button key='edit' onClick={ () => {
				if (!setEditing(id)) {
					setEdit(false);
				}
				close();
			} }>
				Edit
			</button>,
			<button key='delete' onClick={ () => {
				try {
					sender.deleteMessage(id);
				} catch {
					setEdit(false);
				}
				close();
			} }>
				Delete
			</button>,
			<br key='br' />,
		];
	}, [edit, id, close, sender, setEditing]);

	return (
		<>
			{ elements }
			<button onClick={ () => {
				close();
			} }>
				Close
			</button>
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
			{ /* Space so copied text looks nicer */ ' ' }
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
				{ before }
				<span className='from' data-id={ message.from.id } onClick={ onClick } style={ style }>{ message.from.name }</span>
				{ ' -> ' }
				<span className='to' data-id={ message.to.id } onClick={ onClick } style={ { color: message.to.labelColor } }>{ message.to.name }</span>
				{ after }
			</span>
		);
	}

	return (
		<span className='name'>
			{ before }
			<span className='from' data-id={ message.from.id } onClick={ onClick } style={ style }>{ message.from.name }</span>
			{ after }
		</span>
	);
}

function ActionMessage({ message }: { message: IChatroomMessageActionProcessed; }): ReactElement | null {
	const [folded, setFolded] = useState(true);

	const [content, extraContent] = useMemo(() => RenderActionContent(message), [message]);

	// If there is nothing to disply, hide this message
	if (content.length === 0 && extraContent == null)
		return null;

	const style = message.type === 'action' && message.data?.character ? ({ backgroundColor: message.data.character.labelColor + '44' }) : undefined;

	return (
		<div className={ classNames('message', message.type, extraContent !== null ? 'foldable' : null) } style={ style } onClick={ () => setFolded(!folded) }>
			<DisplayInfo message={ message } />
			{ extraContent != null ? (folded ? '\u25ba ' : '\u25bc ') : null }
			{ content.map((c, i) => RenderChatPart(c, i)) }
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
