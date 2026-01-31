import classNames from 'classnames';
import type { Immutable } from 'immer';
import { GetLogger, IDirectoryAccountInfo, LIMIT_DIRECT_MESSAGE_STORE_COUNT } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { useAutoScroll } from '../../common/useAutoScroll.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import type { LoadedDirectMessage } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { useNotificationSuppress, type NotificationSuppressionHook } from '../../services/notificationHandler.tsx';
import { AutoCompleteHint } from '../../ui/components/chat/chatInput.tsx';
import { ChatInputContext, IChatInputHandler } from '../../ui/components/chat/chatInputContext.ts';
import { RenderChatPart } from '../../ui/components/chat/chatMessageText.tsx';
import { AutocompleteDisplayData } from '../../ui/components/chat/commandsProcessor.ts';
import { ColoredName } from '../../ui/components/common/coloredName.tsx';
import { Column } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { DirectMessageChannelProvider, useDirectMessageChat } from '../gameContext/directMessageChannelProvieder.tsx';
import { useDirectMessageCommandContext } from './directMessageCommandContext.tsx';
import { DIRECT_MESSAGE_COMMANDS } from './directMessageCommands.tsx';
import { DirectMessageInput, DirectMessageInputSaveStorage } from './directMessageInput.tsx';

export function DirectMessage({ accountId }: {
	accountId: number;
}): ReactElement {
	const ref = React.useRef<HTMLTextAreaElement>(null);
	const chatId: string = `chat:${accountId}`;
	const [autocompleteHint, setAutocompleteHint] = React.useState<AutocompleteDisplayData | null>(null);

	const messagesDiv = useRef<HTMLDivElement>(null);
	const scrollFnRef = useRef<(forceScroll: boolean, behavior?: ScrollBehavior) => void>(null);

	const ctx = React.useMemo((): IChatInputHandler => ({
		setValue: (value: string) => {
			if (ref.current) {
				ref.current.value = value;
			}
			DirectMessageInputSaveStorage.produceImmer((d) => {
				const dSaveData = (d[chatId] ??= { input: '', history: [] });
				dSaveData.input = value;
			});
		},
		targets: null,
		setTargets: () => { /* Not supported */ },
		editing: null,
		setEditing: () => {
			// Not supported
			return false;
		},
		autocompleteHint,
		setAutocompleteHint,
		mode: null,
		setMode: () => { /* Not supported */ },
		showSelector: false,
		setShowSelector: () => { /* Not supported */ },
		allowCommands: true,
		ref,
	}), [autocompleteHint, chatId]);

	useNotificationSuppress(useCallback<NotificationSuppressionHook>((notification) => {
		return (
			notification.type === 'contactsDirectMessageReceivedContact' ||
			notification.type === 'contactsDirectMessageReceivedUnknown'
		) && notification.metadata.from === accountId;
	}, [accountId]));

	const scroll = useCallback((forceScroll: boolean, behavior?: ScrollBehavior): void => {
		scrollFnRef.current?.(forceScroll, behavior);
	}, []);

	return (
		<div className='chatArea'>
			<ChatInputContext.Provider value={ ctx }>
				<DirectMessageChannelProvider accountId={ accountId }>
					<DirectMessageList
						ref={ messagesDiv }
						scrollRef={ scrollFnRef }
					/>
					<DirectMessageInput
						ref={ ref }
						chatId={ chatId }
						messagesDiv={ messagesDiv }
						scrollMessagesView={ scroll }
					/>
				</DirectMessageChannelProvider>
			</ChatInputContext.Provider>
		</div>
	);
}

function DirectMessageList({ scrollRef, ref }: {
	scrollRef?: RefObject<((forceScroll: boolean, behavior?: ScrollBehavior) => void) | null>;
	ref?: RefObject<HTMLDivElement | null>;
}): ReactElement | null {
	const { interfaceChatroomChatFontSize } = useAccountSettings();
	const { chat, encryption } = useDirectMessageChat();
	const { displayName } = useObservable(chat.displayInfo);
	const encryptedMessages = useObservable(chat.messages);
	const account = useCurrentAccount();
	const [autoScrollRef, scroll] = useAutoScroll<HTMLDivElement>([encryptedMessages]);

	const resizeObserver = useMemo(() => new ResizeObserver(() => scroll(false, 'instant')), [scroll]);
	const messagesDivHandler = useCallback((div: HTMLDivElement | null) => {
		if (autoScrollRef.current != null) {
			resizeObserver.unobserve(autoScrollRef.current);
		}
		autoScrollRef.current = div;
		if (ref !== undefined) {
			ref.current = div;
		}
		if (div != null) {
			resizeObserver.observe(div);
		}
	}, [autoScrollRef, ref, resizeObserver]);

	useImperativeHandle(scrollRef, () => scroll, [scroll]);

	if (!account) {
		return (
			<div className='messagesArea'>
				<Column className='fill'>
					<div className='warning-box'>
						Error: Not connected
					</div>
				</Column>
			</div>
		);
	}

	const lastInvalidKeyMessage = encryptedMessages.findLastIndex((message) => message.keyHash !== encryption.keyHash);

	return (
		<div
			className={ classNames(
				'messagesArea',
				`fontSize-${interfaceChatroomChatFontSize}`,
			) }
		>
			<Scrollable
				ref={ messagesDivHandler }
				className='fill'
			>
				<Column gap='none' className='messagesContainer'>
					<Column alignX='center' padding='large' gap='tiny' className='text-dim'>
						<span>This is the beginning of your direct message history with { displayName ?? '[Loading ...]' } ({ chat.id })</span>
						<span>Only the <strong>last { LIMIT_DIRECT_MESSAGE_STORE_COUNT } messages</strong> per chat are saved</span>
					</Column>
					{ encryptedMessages.map((message, i) => (
						<React.Fragment key={ message.time }>
							<DirectMessageElement
								message={ message }
								currentAccount={ account }
							/>
							{
								i === lastInvalidKeyMessage ? (
									<OldMessagesKeyWarning />
								) : null
							}
						</React.Fragment>
					)) }
				</Column>
			</Scrollable>
			<DirectMessageAutoCompleteHint />
		</div>
	);
}

function OldMessagesKeyWarning(): ReactElement {
	return (
		<div className='message serverMessage'>
			The messages above cannot be decrypted, because either you or your conversation partner reset your account password.<br />
			Because of that, a fresh encryption key was generated for this conversation, making older messages unrecoverable.<br />
			Sending a new message will delete the older messages from the conversation history.
		</div>
	);
}

function DirectMessageAutoCompleteHint(): ReactElement | null {
	const ctx = useDirectMessageCommandContext(false);

	return (
		<AutoCompleteHint ctx={ ctx } commands={ DIRECT_MESSAGE_COMMANDS } />
	);
}

function DirectMessageElement({ message, currentAccount }: {
	message: Immutable<LoadedDirectMessage>;
	currentAccount: IDirectoryAccountInfo;
}): ReactElement {
	const { chat } = useDirectMessageChat();
	const displayInfo = useObservable(chat.displayInfo);
	const { labelColor: accountLabelColor } = useAccountSettings();

	const displayNameElement = useMemo(() => {
		const { labelColor, displayName } = message.source === currentAccount.id ? {
			displayName: currentAccount.displayName,
			labelColor: accountLabelColor,
		} : {
			labelColor: displayInfo.labelColor,
			displayName: displayInfo.displayName ?? '[Loading ...]',
		};

		return (
			<span className='name'>
				<ColoredName
					className='from'
					color={ labelColor }
					data-id={ message.source }
					title={ `${displayName} (${message.source})` }
				>
					{ displayName }
				</ColoredName>
				{ ': ' }
			</span>
		);
	}, [message, currentAccount, accountLabelColor, displayInfo]);
	const time = useMemo(() => new Date(message.time), [message.time]);

	return (
		<div className='message chat'>
			<span className='info'>
				<time>
					{ time.toLocaleDateString() } { time.toLocaleTimeString('en-IE').substring(0, 5) }
				</time>
				{ message.edited ? <span> [edited]</span> : null }
				{ /* Space so copied text looks nicer */ ' ' }
			</span>
			{ displayNameElement }
			<DirectMessageContents message={ message } />
		</div>
	);
}

function DirectMessageContents({ message }: { message: Immutable<LoadedDirectMessage>; }): ReactElement {
	const { chat, encryption } = useDirectMessageChat();

	const [error, setError] = useState<null | 'invalidKey' | 'error'>(null);

	useEffect(() => {
		if (message.decrypted != null) {
			setError(null);
			return;
		}

		if (message.keyHash !== encryption.keyHash) {
			setError('invalidKey');
			return;
		}

		chat.decryptMessage(message)
			.then((result) => {
				setError(result ? null : 'error');
			})
			.catch((err) => {
				setError('error');
				GetLogger('DirectMessageContents')
					.error('Failed to decrypt message:', err);
			});
	}, [message, encryption, chat]);

	if (error === 'invalidKey') {
		return (
			<span className='error'>[ Unable to decrypt message created with a different key ]</span>
		);
	} else if (error === 'error') {
		return (
			<span className='error'>[ ERROR: Failed to decrypt the message ]</span>
		);
	} else if (message.decrypted == null) {
		return (
			<span>
				[ <i>Decrypting...</i> ] <br />
				{ message.content }
			</span>
		);
	}

	return (
		// eslint-disable-next-line react/jsx-no-useless-fragment
		<>
			{ ...message.decrypted.map((c, i) => RenderChatPart(c, i, true)) }
		</>
	);
}
