import classNames from 'classnames';
import { CharacterId, IChatMessageAction, IChatMessageChat, SpaceId } from 'pandora-common';
import React, {
	memo,
	ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { ContextMenu, useContextMenu } from '../../../components/contextMenu';
import { useChatMessages, useChatMessageSender } from '../../../components/gameContext/gameStateContextProvider';
import { NotificationSource, useNotificationSuppressed } from '../../../components/gameContext/notificationContextProvider';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider';
import { AutoCompleteHint, ChatInputArea, useChatCommandContext, useChatInput } from './chatInput';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar';
import { useAutoScroll } from '../../../common/useAutoScroll';
import { IChatMessageProcessed, IsActionMessage, RenderActionContent, RenderChatPart } from './chatMessages';
import { useEffectiveAccountSettings } from '../../../components/gameContext/directoryConnectorContextProvider';
import { Column } from '../../../components/common/container/container';
import { COMMANDS } from './commands';

export function Chat(): ReactElement | null {
	const messages = useChatMessages();
	const shardConnector = useShardConnector();
	const { interfaceChatroomChatFontSize } = useEffectiveAccountSettings();
	const [messagesDiv, scroll, isScrolling] = useAutoScroll<HTMLDivElement>([messages]);
	const lastMessageCount = useRef(0);
	let newMessageCount = 0;

	useNotificationSuppressed(NotificationSource.CHAT_MESSAGE, isScrolling);

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
			<div
				className={ classNames(
					'messages',
					`fontSize-${interfaceChatroomChatFontSize}`,
				) }
			>
				<Scrollable color='dark' className='fill' ref={ messagesDiv } tabIndex={ 1 }>
					<Column gap='none'>
						{ messages.map((m) => <Message key={ m.time } message={ m } playerId={ playerId } />) }
					</Column>
				</Scrollable>
				<ChatAutoCompleteHint />
			</div>
			<ChatInputArea messagesDiv={ messagesDiv } scroll={ scroll } newMessageCount={ newMessageCount } />
		</div>
	);
}

function ChatAutoCompleteHint() {
	const ctx = useChatCommandContext();
	return (
		<AutoCompleteHint ctx={ ctx } commands={ COMMANDS } />
	);
}

function ChatMessageEquals(a: IChatMessageProcessed, b: IChatMessageProcessed): boolean {
	return a.time === b.time && a.edited === b.edited && a.spaceId === b.spaceId;
}

const Message = memo(function Message({ message, playerId }: { message: IChatMessageProcessed; playerId: CharacterId | null; }): ReactElement | null {
	if (IsActionMessage(message)) {
		return <ActionMessage message={ message } />;
	}
	if (message.type === 'deleted') {
		return null;
	}
	return <DisplayUserMessage message={ message } playerId={ playerId } />;
}, (prev, next) => {
	return ChatMessageEquals(prev.message, next.message) && prev.playerId === next.playerId;
});

function DisplayUserMessage({ message, playerId }: { message: IChatMessageChat & { time: number; spaceId: SpaceId | null; }; playerId: CharacterId | null; }): ReactElement {
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
	const { editing } = useChatInput();
	const editingClass = editing?.target === message.id ? 'editing' : undefined;

	const style = message.type === 'me' || message.type === 'emote' ? ({ backgroundColor: message.from.labelColor + '44' }) : undefined;
	const isPrivate = 'to' in message && message.to;
	const self = message.from.id === playerId;
	return (
		<>
			<div
				className={ classNames(
					'message',
					message.type,
					isPrivate && 'private',
					editingClass,
				) }
				style={ style }
				onContextMenu={ self ? onContextMenu : undefined }
			>
				<DisplayInfo message={ message } />
				{ before }
				<DisplayName message={ message } color={ message.from.labelColor } />
				{ ...message.parts.map((c, i) => RenderChatPart(c, i, message.type === 'ooc')) }
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
	const sender = useChatMessageSender();
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

function DisplayInfo({ message }: { message: IChatMessageProcessed; }): ReactElement {
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

function DisplayName({ message, color }: { message: IChatMessageChat; color: string; }): ReactElement | null {
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

export function ActionMessage({ message, ignoreColor = false }: { message: IChatMessageProcessed<IChatMessageAction>; ignoreColor?: boolean; }): ReactElement | null {
	const assetManager = useAssetManager();
	const [folded, setFolded] = useState(true);

	const [content, extraContent] = useMemo(() => RenderActionContent(message, assetManager), [message, assetManager]);

	// If there is nothing to display, hide this message
	if (content.length === 0 && extraContent == null)
		return null;

	const style = (message.type === 'action' && message.data?.character && !ignoreColor) ? ({ backgroundColor: message.data.character.labelColor + '44' }) : undefined;

	return (
		<div
			className={ classNames(
				'message',
				message.type,
				extraContent !== null ? 'foldable' : null,
			) }
			style={ style }
			onClick={ () => setFolded(!folded) }
		>
			<DisplayInfo message={ message } />
			{ extraContent != null ? (folded ? '\u25ba ' : '\u25bc ') : null }
			{ content.map((c, i) => RenderChatPart(c, i, false)) }
			{ extraContent != null && folded ? ' ( ... )' : null }
			{
				!folded && extraContent != null && (
					<>
						<br />
						{ extraContent.map((c, i) => RenderChatPart(c, i, false)) }
					</>
				)
			}
		</div>
	);
}
