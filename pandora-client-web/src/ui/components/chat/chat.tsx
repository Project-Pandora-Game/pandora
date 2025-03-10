import classNames from 'classnames';
import { AssertNever, CharacterId, IChatMessageChat, type HexColorString } from 'pandora-common';
import React, {
	memo,
	ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { useAutoScroll } from '../../../common/useAutoScroll.ts';
import { Column } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { ContextMenu, useContextMenu } from '../../../components/contextMenu/index.ts';
import { useChatMessages, useChatMessageSender, useGameState } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { NotificationSource, useNotificationSuppressed } from '../../../services/notificationHandler.ts';
import { useChatInjectedMessages } from './chatInjectedMessages.tsx';
import { AutoCompleteHint, ChatInputArea, useChatCommandContext, useChatInput } from './chatInput.tsx';
import { IChatMessageProcessed, IsActionMessage, RenderActionContent, RenderChatPart, type IChatActionMessageProcessed, type IChatNormalMessageProcessed } from './chatMessages.tsx';
import { COMMANDS } from './commands.ts';

export function Chat(): ReactElement | null {
	const gameState = useGameState();
	const messages = useChatMessages();
	const injectedMessages = useChatInjectedMessages(gameState);
	const shardConnector = useShardConnector();
	const { interfaceChatroomChatFontSize } = useAccountSettings();
	const [messagesDiv, scroll, isScrolling] = useAutoScroll<HTMLDivElement>([messages, injectedMessages]);
	const lastMessageCount = useRef(0);
	let newMessageCount = 0;

	useNotificationSuppressed(NotificationSource.CHAT_MESSAGE, isScrolling);

	const playerId = usePlayerId();

	// Combine normal and injected messages
	const finalMessages = useMemo((): readonly ReactElement[] => {
		const result = new Array<ReactElement>(messages.length + injectedMessages.length);
		let t = 0;
		let messagesIndex = 0;
		let injectedMessagesIndex = 0;

		while (messagesIndex < messages.length && injectedMessagesIndex < injectedMessages.length) {
			const injectedMessage = injectedMessages[injectedMessagesIndex];
			const normalMessage = messages[messagesIndex];
			if (injectedMessage.time < normalMessage.time) {
				result[t++] = injectedMessage.element;
				injectedMessagesIndex++;
			} else {
				result[t++] = (
					<Message
						key={ normalMessage.time }
						message={ normalMessage }
						playerId={ playerId }
					/>
				);
				messagesIndex++;
			}
		}
		while (messagesIndex < messages.length) {
			const normalMessage = messages[messagesIndex++];
			result[t++] = (
				<Message
					key={ normalMessage.time }
					message={ normalMessage }
					playerId={ playerId }
				/>
			);
		}
		while (injectedMessagesIndex < injectedMessages.length) {
			result[t++] = injectedMessages[injectedMessagesIndex++].element;
		}

		return result;
	}, [messages, injectedMessages, playerId]);

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
					'messagesArea',
					`fontSize-${interfaceChatroomChatFontSize}`,
				) }
			>
				<Scrollable
					ref={ messagesDiv }
					className='fill'
					tabIndex={ 1 }
				>
					<Column gap='none' className='messagesContainer'>
						{ finalMessages }
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
	if (a.time !== b.time || a.spaceId !== b.spaceId)
		return false;

	switch (a.type) {
		case 'chat':
		case 'ooc':
		case 'me':
		case 'emote':
			return b.type === a.type && a.edited === b.edited;
		case 'deleted':
			return b.type === a.type;
		case 'action':
		case 'serverMessage':
			return b.type === a.type && a.repetitions === b.repetitions;
	}
	AssertNever(a);
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

function DisplayUserMessage({ message, playerId }: { message: IChatNormalMessageProcessed; playerId: CharacterId | null; }): ReactElement {
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
				<DisplayInfo messageTime={ message.time } edited={ message.edited ?? false } />
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

function DisplayInfo({ messageTime, edited }: {
	messageTime: number;
	edited: boolean;
}): ReactElement {
	const time = useMemo(() => new Date(messageTime), [messageTime]);
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
	}, [messageTime, full]);

	return (
		<span className='info'>
			{ full
				? <time>{ `${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)}` }</time>
				: <time>{ time.toLocaleTimeString('en-IE').substring(0, 5) }</time> }
			{ edited ? <span> [edited]</span> : null }
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
				// For /me messages that start with 's we don't insert a space, so the displayed message becomes "Name's"
				// This works for both `*'s thing` and `/me 's thing`, which both display as `Name's thing`
				return ['', message.parts.length > 0 && message.parts[0][1].startsWith('\'s') ? '' : ' '];
			default:
				return ['', ''];
		}
	}, [message.type, message.parts]);

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
				<span
					className='from'
					data-id={ message.from.id }
					title={ `${message.from.name} (${message.from.id})` }
					onClick={ onClick }
					style={ style }
				>
					{ message.from.name }
				</span>
				{ ' -> ' }
				<span
					className='to'
					data-id={ message.to.id }
					title={ `${message.to.name} (${message.to.id})` }
					onClick={ onClick }
					style={ { color: message.to.labelColor } }
				>
					{ message.to.name }
				</span>
				{ after }
			</span>
		);
	}

	return (
		<span className='name'>
			{ before }
			<span
				className='from'
				data-id={ message.from.id }
				title={ `${message.from.name} (${message.from.id})` }
				onClick={ onClick }
				style={ style }
			>
				{ message.from.name }
			</span>
			{ after }
		</span>
	);
}

export function ActionMessageElement({ type, labelColor, messageTime, edited, repetitions = 1, children, extraContent, defaultUnfolded = false }: {
	type: 'action' | 'serverMessage';
	labelColor?: HexColorString;
	messageTime: number;
	edited: boolean;
	repetitions?: number;
	children: ReactNode;
	extraContent?: ReactElement | null;
	/**
	 * Unfold the message's extra content by default (if it has any).
	 * @default false
	 */
	defaultUnfolded?: boolean;
}): ReactElement | null {
	const [folded, setFolded] = useState(!defaultUnfolded);
	const repetitionCountRef = useRef<HTMLSpanElement>(null);
	const lastRepetitionCount = useRef(repetitions);

	// Do a highlight if the repetitions count changes on an existing message
	useEffect(() => {
		if (repetitions > 1 && repetitions !== lastRepetitionCount.current) {
			lastRepetitionCount.current = repetitions;
			repetitionCountRef.current?.classList.remove('highlightChange');
			requestAnimationFrame(() => {
				repetitionCountRef.current?.classList.add('highlightChange');
			});
		}
	}, [repetitions]);

	const style = (type === 'action' && labelColor) ? ({ backgroundColor: labelColor + '44' }) : undefined;

	return (
		<div
			className={ classNames(
				'message',
				type,
				extraContent !== null ? 'foldable' : null,
			) }
			style={ style }
			onClick={ () => setFolded(!folded) }
		>
			<DisplayInfo messageTime={ messageTime } edited={ edited } />
			{ extraContent != null ? (folded ? '\u25ba ' : '\u25bc ') : null }
			{ children }
			{ extraContent != null && folded ? ' ( ... )' : null }
			{
				repetitions > 1 ? (
					<> <span className='repetitionCount' ref={ repetitionCountRef }>&#xD7;{ repetitions }</span></>
				) : null
			}
			{
				!folded && extraContent != null ? (
					<>
						<br />
						{ extraContent }
					</>
				) : null
			}
		</div>
	);
}

export function ActionMessage({ message, ignoreColor = false }: { message: IChatActionMessageProcessed; ignoreColor?: boolean; }): ReactElement | null {
	const assetManager = useAssetManager();
	const { interfaceChatroomItemDisplayNameType } = useAccountSettings();

	const [content, extraContent] = useMemo(() => RenderActionContent(message, assetManager, interfaceChatroomItemDisplayNameType), [message, assetManager, interfaceChatroomItemDisplayNameType]);

	// If there is nothing to display, hide this message
	if (content == null && extraContent == null)
		return null;

	return (
		<ActionMessageElement
			type={ message.type }
			labelColor={ message.data?.character && !ignoreColor ? message.data.character.labelColor : undefined }
			messageTime={ message.time }
			edited={ false }
			repetitions={ message.repetitions }
			extraContent={ extraContent != null ? (
				<>
					{ extraContent }
				</>
			) : null }
		>
			{ content }
		</ActionMessageElement>
	);
}
