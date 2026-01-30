import classNames from 'classnames';
import type { Immutable } from 'immer';
import { uniq } from 'lodash-es';
import { CharacterId, CharacterIdSchema, ChatMessageChat, NaturalListJoin, type AccountSettings, type ChatMessageChatCharacter, type HexColorString, type RoomId } from 'pandora-common';
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
import { GetCurrentAssetManager, useAssetManager } from '../../../assets/assetManager.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { ContextMenu, useContextMenu } from '../../../components/contextMenu/index.ts';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatMessageSender } from '../../../services/gameLogic/chatHooks.ts';
import { ColoredName } from '../common/coloredName.tsx';
import { ActionLogEntry } from './actionLogEntry.tsx';
import { ChatMessageShouldDim, useChatInput } from './chatInputContext.ts';
import { RenderActionContent, RenderActionContentToString } from './chatMessageAction.tsx';
import { RenderChatPart, RenderChatPartToString } from './chatMessageText.tsx';
import { IsActionMessage, type ChatActionMessagePreprocessed, type ChatMessagePreprocessed, type ChatMessageProcessedRoomData, type ChatNormalMessageProcessed } from './chatMessageTypes.ts';

export const ChatMessage = memo(function ChatMessage({ message, playerId }: { message: ChatMessagePreprocessed; playerId: CharacterId | null; }): ReactElement | null {
	if (IsActionMessage(message)) {
		return <ActionMessage message={ message } />;
	}
	if (message.type === 'actionLog') {
		return <ActionLogEntry entry={ message } />;
	}
	if (message.type === 'deleted') {
		return null;
	}
	return <DisplayUserMessage message={ message } playerId={ playerId } />;
});

export function RenderChatMessageToString(message: ChatMessagePreprocessed, accountSettings: Immutable<AccountSettings>): string {
	if (IsActionMessage(message)) {
		return RenderActionMessageToString(message, accountSettings);
	}
	if (message.type === 'actionLog') {
		return ''; // Action log does not support rendering to string
	}
	if (message.type === 'deleted') {
		return '';
	}
	return RenderUserMessageToString(message);
}

function DisplayUserMessage({ message, playerId }: { message: ChatNormalMessageProcessed; playerId: CharacterId | null; }): ReactElement {
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
					isPrivate ? 'private' : null,
					ChatMessageShouldDim(message) ? 'dim' : null,
					editingClass,
				) }
				style={ style }
				onContextMenu={ self ? onContextMenu : undefined }
			>
				<DisplayInfo
					messageTime={ message.time }
					edited={ message.edited ?? false }
					rooms={ [message.roomData] }
					receivedRoomId={ message.receivedRoomId }
					from={ message.from }
				/>
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

function RenderUserMessageToString(message: ChatNormalMessageProcessed): string {
	const [before, after] = (() => {
		switch (message.type) {
			case 'ooc':
				return ['', ' ))'];
			case 'emote':
			case 'me':
				return ['*', '*'];
			default:
				return ['', ''];
		}
	})();

	return before +
		RenderChatNameToString(message) +
		message.parts.map((c) => RenderChatPartToString(c, message.type === 'ooc')).join('') +
		after;
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
			<Button theme='transparent' key='edit' onClick={ () => {
				if (!setEditing(id)) {
					setEdit(false);
				}
				close();
			} }>
				Edit
			</Button>,
			<Button theme='transparent' key='delete' onClick={ () => {
				try {
					sender.deleteMessage(id);
				} catch {
					setEdit(false);
				}
				close();
			} }>
				Delete
			</Button>,
			<br key='br' />,
		];
	}, [edit, id, close, sender, setEditing]);

	return (
		<>
			{ elements }
			<Button theme='transparent' onClick={ () => {
				close();
			} }>
				Close
			</Button>
		</>
	);
}

function DisplayInfo({ messageTime, edited, rooms, receivedRoomId, from }: {
	messageTime: number | null;
	edited: boolean;
	rooms: readonly ChatMessageProcessedRoomData[] | null;
	receivedRoomId: RoomId | null;
	from?: ChatMessageChatCharacter;
}): ReactElement {
	const time = useMemo(() => messageTime != null ? new Date(messageTime) : null, [messageTime]);
	const [full, setFull] = useState(new Date().getDate() !== time?.getDate());

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
		<span className='info' translate='no'>
			{ time != null ? (
				<span title={ `${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE')}` + (from != null ? ` by ${ from.name } (${ from.id })` : '') }>
					{
						full ? `${time.toLocaleDateString()} ${time.toLocaleTimeString('en-IE').substring(0, 5)} ` :
						(time.toLocaleTimeString('en-IE').substring(0, 5) + ' ')
					}
				</span>
			) : null }
			{ edited ? <span>[edited] </span> : null }
			{ rooms && rooms.length > 0 && (rooms.length > 1 || rooms[0].id !== receivedRoomId) ? (
				<span className='roomInfo' title={ NaturalListJoin(rooms.map((r) => r.name)) }>
					{ rooms.length > 1 ? '[multiple rooms] ' : <>[<span className='roomName'>{ rooms[0].name }</span>] </> }
				</span>
			) : null }
		</span>
	);
}

function DisplayName({ message, color }: { message: ChatMessageChat; color: HexColorString; }): ReactElement | null {
	const { setTargets, targets: whisperTargets } = useChatInput();
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
		event.preventDefault();

		const id = event.currentTarget.getAttribute('data-id');
		if (!id || id === playerId)
			return;

		const parsedId = CharacterIdSchema.parse(id);
		if (event.shiftKey || event.ctrlKey) {
			// Toggle when holding shift/ctrl
			const newWhispering = whisperTargets?.map((t) => t.id) ?? [];
			const currentIndex = newWhispering.indexOf(parsedId);
			if (currentIndex >= 0) {
				newWhispering.splice(currentIndex, 1);
			} else {
				newWhispering.push(parsedId);
			}
			setTargets(newWhispering.length > 0 ? newWhispering : null);
		} else {
			setTargets([parsedId]);
		}
	}, [setTargets, whisperTargets, playerId]);

	const replyAll = useCallback((event: React.MouseEvent<HTMLSpanElement>) => {
		event.stopPropagation();
		event.preventDefault();

		const ids = uniq([message.from.id, ...('to' in message && message.to ? message.to.map((t) => t.id) : [])].filter((t) => t !== playerId));
		setTargets(ids);
	}, [setTargets, playerId, message]);

	if ('to' in message && message.to) {
		return (
			<span className='name' translate='no'>
				{ before }
				<ColoredName
					className='from cursor-pointer'
					color={ color }
					data-id={ message.from.id }
					title={ `${message.from.name} (${message.from.id})` + (message.from.id === playerId ? ' [You]' : ' (click to whisper)') }
					onClick={ onClick }
				>
					{ message.from.name }
				</ColoredName>
				{ ' ' }
				<span
					className='cursor-pointer'
					title='This message is a whisper (click to reply)'
					onClick={ replyAll }
				>
					{ '->' }
				</span>
				{ ' ' }
				{ message.to.map((t, i) => (
					<React.Fragment key={ i }>
						{ i !== 0 ? ', ' : null }
						<ColoredName
							className='to cursor-pointer'
							color={ t.labelColor }
							data-id={ t.id }
							title={ `${t.name} (${t.id})` + (t.id === playerId ? ' [You]' : ' (click to whisper)') }
							onClick={ onClick }
						>
							{ t.name }
						</ColoredName>
					</React.Fragment>
				)) }
				{ after }
			</span>
		);
	}

	return (
		<span className='name' translate='no'>
			{ before }
			{ message.type !== 'me' && message.type !== 'emote' ? (
				<ColoredName
					className='from cursor-pointer'
					color={ color }
					data-id={ message.from.id }
					title={ `${message.from.name} (${message.from.id})` + (message.from.id === playerId ? ' [You]' : ' (click to whisper)') }
					onClick={ onClick }
				>
					{ message.from.name }
				</ColoredName>
			) : (
				<span
					className='from cursor-pointer'
					data-id={ message.from.id }
					title={ `${message.from.name} (${message.from.id})` + (message.from.id === playerId ? ' [You]' : ' (click to whisper)') }
					onClick={ onClick }
				>
					{ message.from.name }
				</span>
			) }
			{ after }
		</span>
	);
}

function RenderChatNameToString(message: ChatMessageChat): string {
	// Emote has no name
	if (message.type === 'emote')
		return '';

	const [before, after] = (() => {
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
	})();

	if ('to' in message && message.to) {
		return before + message.from.name + ' -> ' + message.to.map((t) => t.name).join(', ') + after;
	}

	return before + message.from.name + after;
}

export const ActionMessageElement = memo(function ActionMessageElement({ type, labelColor, messageTime, edited, repetitions = 1, dim = false, rooms = null, receivedRoomId, children, extraContent, defaultUnfolded = false }: {
	type: 'action' | 'serverMessage';
	labelColor?: HexColorString;
	messageTime: number | null;
	edited: boolean;
	repetitions?: number;
	dim?: boolean;
	rooms: readonly ChatMessageProcessedRoomData[] | null;
	receivedRoomId: RoomId | null;
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
				dim ? 'dim' : null,
			) }
			style={ style }
			onClick={ () => setFolded(!folded) }
			translate='no'
		>
			<DisplayInfo
				messageTime={ messageTime }
				edited={ edited }
				rooms={ rooms }
				receivedRoomId={ receivedRoomId }
			/>
			{ extraContent != null ? (folded ? '\u25ba ' : '\u25bc ') : null }
			{ children }
			{ extraContent != null && folded ? ' ( \u2026 )' : null }
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
});

export function ActionMessage({ message, ignoreColor = false }: { message: ChatActionMessagePreprocessed; ignoreColor?: boolean; }): ReactElement | null {
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
			dim={ ChatMessageShouldDim(message) }
			rooms={ message.roomsData }
			receivedRoomId={ message.receivedRoomId }
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

export function RenderActionMessageToString(message: ChatActionMessagePreprocessed, { interfaceChatroomItemDisplayNameType }: Immutable<AccountSettings>): string {
	const assetManager = GetCurrentAssetManager();

	const [content, extraContent] = RenderActionContentToString(message, assetManager, interfaceChatroomItemDisplayNameType);

	// If there is nothing to display, hide this message
	if (content == null && extraContent == null)
		return '';

	return content +
		(extraContent != null ? ' ( ... )' : '');
}
