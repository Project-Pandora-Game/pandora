import classNames from 'classnames';
import {
	ReactElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useAutoScroll } from '../../../common/useAutoScroll.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider.tsx';
import { useObservable } from '../../../observable.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatMessages } from '../../../services/gameLogic/chatHooks.ts';
import { useGameState } from '../../../services/gameLogic/gameStateHooks.ts';
import { useNotificationSuppress, type NotificationSuppressionHook } from '../../../services/notificationHandler.tsx';
import { useChatInjectedMessages } from './chatInjectedMessages.tsx';
import { AutoCompleteHint, ChatInputArea, useChatCommandContext } from './chatInput.tsx';
import { ChatActionLog, ChatFocusMode, useChatActionLogDisabled, useChatFocusModeForced } from './chatInputContext.tsx';
import { ChatMessage } from './chatMessage.tsx';
import { COMMANDS } from './commands.ts';

export function Chat(): ReactElement | null {
	const gameState = useGameState();
	const messages = useChatMessages();
	const injectedMessages = useChatInjectedMessages(gameState);
	const focusModeSetting = useObservable(ChatFocusMode);
	const focusModeForced = useChatFocusModeForced();
	const actionLogDisabled = useChatActionLogDisabled();
	const focusMode = focusModeForced ?? focusModeSetting;
	const actionLogSetting = useObservable(ChatActionLog);
	const displayActionLogMessages = actionLogSetting && !actionLogDisabled;

	const shardConnector = useShardConnector();
	const { interfaceChatroomChatFontSize, chatMaxShownMessages } = useAccountSettings();
	const [messagesDiv, scroll, isScrolling] = useAutoScroll<HTMLDivElement>([messages, injectedMessages]);
	const lastMessageCount = useRef(0);
	let newMessageCount = 0;

	const [showAllMessages, setShowAllMessages] = useState(false);

	useNotificationSuppress(useCallback<NotificationSuppressionHook>((notification) => {
		return (
			notification.type === 'chatMessagesMessage' ||
			notification.type === 'chatMessagesEmote' ||
			notification.type === 'chatMessagesOOC' ||
			notification.type === 'chatMessagesWhisper' ||
			notification.type === 'chatMessagesOOCWhisper' ||
			notification.type === 'chatMessagesAction' ||
			notification.type === 'chatMessagesServer' ||
			notification.type === 'spaceCharacterJoined'
		);
	}, []));

	const playerId = usePlayerId();

	// Combine normal and injected messages
	const finalMessages = useMemo((): readonly ReactElement[] => {
		let result = new Array<ReactElement>(messages.length + injectedMessages.length);
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
				messagesIndex++;

				if (normalMessage.type === 'actionLog' && !displayActionLogMessages)
					continue;

				result[t++] = (
					<ChatMessage
						key={ normalMessage.time }
						message={ normalMessage }
						playerId={ playerId }
					/>
				);
			}
		}
		while (messagesIndex < messages.length) {
			const normalMessage = messages[messagesIndex++];

			if (normalMessage.type === 'actionLog' && !displayActionLogMessages)
				continue;

			result[t++] = (
				<ChatMessage
					key={ normalMessage.time }
					message={ normalMessage }
					playerId={ playerId }
				/>
			);
		}
		while (injectedMessagesIndex < injectedMessages.length) {
			result[t++] = injectedMessages[injectedMessagesIndex++].element;
		}

		if (chatMaxShownMessages != null && t > chatMaxShownMessages && !showAllMessages) {
			result = result.slice(t - chatMaxShownMessages, t);
			result.unshift(
				<Row alignX='center' padding='small' key='olderMessagesWarning'>
					<div className='warning-box'>
						<Row alignY='center'>
							<span>Older messages ({ t - chatMaxShownMessages }) are hidden for performance reasons</span>
							<Button
								className='not-selectable'
								onClick={ () => {
									setShowAllMessages(true);
								} }
							>
								Show all messages
							</Button>
						</Row>
					</div>
				</Row>,
			);
		} else {
			result = result.slice(0, t);
		}

		if (showAllMessages) {
			result.push(
				<Row alignX='center' padding='small' key='olderMessagesShownWarning'>
					<div className='warning-box not-selectable'>
						<Row alignY='center'>
							<span>Showing complete chat history</span>
							<Button
								onClick={ () => {
									setShowAllMessages(false);
								} }
							>
								Hide older messages
							</Button>
						</Row>
					</div>
				</Row>,
			);
		}

		return result;
	}, [messages, injectedMessages, chatMaxShownMessages, displayActionLogMessages, playerId, showAllMessages]);

	const resizeObserver = useMemo(() => new ResizeObserver(() => scroll(false, 'instant')), [scroll]);
	const messagesDivHandler = useCallback((div: HTMLDivElement | null) => {
		if (messagesDiv.current != null) {
			resizeObserver.unobserve(messagesDiv.current);
		}
		messagesDiv.current = div;
		if (div != null) {
			resizeObserver.observe(div);
		}
	}, [messagesDiv, resizeObserver]);

	if (!shardConnector) {
		return (
			<div className='warning-box'>
				Error: Not connected
			</div>
		);
	}

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
					focusMode ? 'hideDimmed' : null,
				) }
			>
				<Scrollable
					ref={ messagesDivHandler }
					className='fill'
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
