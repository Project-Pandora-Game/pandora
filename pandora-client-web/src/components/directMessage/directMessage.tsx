import classNames from 'classnames';
import type { Immutable } from 'immer';
import { AssertNever, GetLogger, IDirectoryAccountInfo, LIMIT_DIRECT_MESSAGE_LENGTH, LIMIT_DIRECT_MESSAGE_LENGTH_BASE64, type Promisable } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAutoScroll } from '../../common/useAutoScroll.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useTextFormattingOnKeyboardEvent } from '../../common/useTextFormattingOnKeyboardEvent.ts';
import { useInputAutofocus } from '../../common/userInteraction/inputAutofocus.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import type { LoadedDirectMessage } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { useNotificationSuppress, type NotificationSuppressionHook } from '../../services/notificationHandler.tsx';
import { AutoCompleteHint, IChatInputHandler, chatInputContext, useChatInput } from '../../ui/components/chat/chatInput.tsx';
import { RenderChatPart } from '../../ui/components/chat/chatMessages.tsx';
import { AutocompleteDisplayData, COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, ICommandInvokeContext, RunCommand } from '../../ui/components/chat/commandsProcessor.ts';
import { ColoredName } from '../../ui/components/common/coloredName.tsx';
import { Column } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { DirectMessageChannelProvider, useDirectMessageChat } from '../gameContext/directMessageChannelProvieder.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { useGameStateOptional } from '../gameContext/gameStateContextProvider.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';
import { DIRECT_MESSAGE_COMMANDS, DirectMessageCommandExecutionContext } from './directMessageCommandContext.tsx';

export function DirectMessage({ accountId }: { accountId: number; }): ReactElement {
	const ref = React.useRef<HTMLTextAreaElement>(null);
	const [autocompleteHint, setAutocompleteHint] = React.useState<AutocompleteDisplayData | null>(null);

	const ctx = React.useMemo((): IChatInputHandler => ({
		setValue: (value: string) => {
			if (ref.current) {
				ref.current.value = value;
			}
		},
		targets: null,
		setTargets: () => { /** */ },
		editing: null,
		setEditing: () => false,
		autocompleteHint,
		setAutocompleteHint,
		mode: null,
		setMode: () => { /** */ },
		showSelector: false,
		setShowSelector: () => { /** */ },
		allowCommands: true,
		ref,
	}), [autocompleteHint]);

	useNotificationSuppress(useCallback<NotificationSuppressionHook>((notification) => {
		return (
			notification.type === 'contactsDirectMessageReceivedContact' ||
			notification.type === 'contactsDirectMessageReceivedUnknown'
		) && notification.metadata.from === accountId;
	}, [accountId]));

	return (
		<div className='chatArea'>
			<chatInputContext.Provider value={ ctx }>
				<DirectMessageChannelProvider accountId={ accountId }>
					<DirectMessageList />
					<DirectChannelInput ref={ ref } />
				</DirectMessageChannelProvider>
			</chatInputContext.Provider>
		</div>
	);
}

function DirectMessageList(): ReactElement | null {
	const { interfaceChatroomChatFontSize } = useAccountSettings();
	const { chat, encryption } = useDirectMessageChat();
	const encryptedMessages = useObservable(chat.messages);
	const account = useCurrentAccount();
	const [ref] = useAutoScroll<HTMLDivElement>([encryptedMessages]);

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
				ref={ ref }
				className='fill'
				tabIndex={ 1 }
			>
				<Column gap='none' className='messagesContainer'>
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

function useDirectMessageCommandContext(displayError: boolean): ICommandInvokeContext<DirectMessageCommandExecutionContext> {
	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	const gameState = useGameStateOptional();
	const { chat, encryption } = useDirectMessageChat();
	const navigate = useNavigatePandora();

	const sendMessage = useCallback<DirectMessageCommandExecutionContext['sendMessage']>(async (message, editing) => {
		const encrypted = message.length === 0 ? '' : await encryption.service.encrypt(message);
		if (encrypted.length > LIMIT_DIRECT_MESSAGE_LENGTH_BASE64) {
			toast(`Encrypted message too long: ${encrypted.length} > ${LIMIT_DIRECT_MESSAGE_LENGTH_BASE64}`, TOAST_OPTIONS_ERROR);
			return;
		}
		const response = await directoryConnector.awaitResponse('sendDirectMessage', { id: chat.id, keyHash: encryption.keyHash, content: encrypted, editing });
		if (response.result !== 'ok') {
			toast(`Failed to send message: ${response.result}`, TOAST_OPTIONS_ERROR);
		}
	}, [directoryConnector, chat, encryption]);

	return useMemo((): ICommandInvokeContext<DirectMessageCommandExecutionContext> => ({
		directoryConnector,
		shardConnector,
		gameState,
		chat,
		navigate,
		sendMessage,
		displayError: displayError ? (message) => toast(message, TOAST_OPTIONS_ERROR) : undefined,
	}), [directoryConnector, shardConnector, gameState, chat, navigate, sendMessage, displayError]);
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

function DirectChannelInputImpl(_: unknown, ref: React.ForwardedRef<HTMLTextAreaElement>): ReactElement | null {
	const ctx = useDirectMessageCommandContext(true);
	const chat = ctx.chat;
	const info = useObservable(chat.displayInfo);
	const { editing, setEditing, setAutocompleteHint, allowCommands } = useChatInput();
	const { chatCommandHintBehavior } = useAccountSettings();

	const handleSend = (input: string): Promisable<boolean> => {
		setAutocompleteHint(null);
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			// Process command
			return RunCommand(input.slice(1), ctx, DIRECT_MESSAGE_COMMANDS);
		} else {
			if (input.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
				input = input.slice(1);
			}
			input = input.trim();
			// Ignore empty input, unless editing
			if (editing == null && !input) {
				return false;
			}
			ctx.sendMessage(input, editing?.target)
				.catch((e) => {
					toast(`Failed to send message: ${String(e)}`, TOAST_OPTIONS_ERROR);
					GetLogger('DirectMessage').error('Failed to send message:', e);
				});

			return true;
		}
	};

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		const input = textarea.value;
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				function cleanup() {
					textarea.value = '';
					setEditing(null);
				}

				const result = handleSend(input);
				if (typeof result === 'boolean') {
					if (result) {
						cleanup();
					}
				} else {
					textarea.disabled = true;
					result.then((r) => {
						textarea.disabled = false;
						if (r) {
							cleanup();
						}
					}, (error) => {
						textarea.disabled = false;
						toast('Error processing command', TOAST_OPTIONS_ERROR);
						GetLogger('DirectChannelInput').error('Error async processing input:', error);
					});
				}
			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
				}
			}
		} else if (ev.key === 'Tab' && textarea.value.startsWith(COMMAND_KEY) && !textarea.value.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				// Process command
				const inputPosition = textarea.selectionStart || textarea.value.length;
				const command = textarea.value.slice(1, textarea.selectionStart);

				const autocompleteResult = CommandAutocompleteCycle(command, ctx, DIRECT_MESSAGE_COMMANDS, ev.shiftKey);

				const replacementStart = COMMAND_KEY + autocompleteResult.replace;

				textarea.value = replacementStart + textarea.value.slice(inputPosition).trimStart();
				textarea.setSelectionRange(replacementStart.length, replacementStart.length, 'none');
				if (chatCommandHintBehavior === 'always-show') {
					setAutocompleteHint(autocompleteResult);
				} else if (chatCommandHintBehavior === 'on-tab') {
					setAutocompleteHint(autocompleteResult.nextSegment ? null : autocompleteResult);
				} else {
					AssertNever(chatCommandHintBehavior);
				}

			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
				}
			}
		}
	});

	const onChange = useEvent((ev: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		let input = textarea.value;
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			input = input.slice(1, textarea.selectionStart || textarea.value.length);

			const autocompleteResult = CommandAutocomplete(input, ctx, DIRECT_MESSAGE_COMMANDS);

			if (chatCommandHintBehavior === 'always-show') {
				setAutocompleteHint({
					replace: textarea.value,
					result: autocompleteResult,
					index: null,
					nextSegment: false,
				});
			} else if (chatCommandHintBehavior === 'on-tab') {
				if (autocompleteResult != null &&
					autocompleteResult.options.length === 1 &&
					autocompleteResult.options[0].replaceValue === input &&
					!!autocompleteResult.options[0].longDescription
				) {
					// Display segments with long description anyway, if they match exactly
					setAutocompleteHint({
						replace: textarea.value,
						result: autocompleteResult,
						index: null,
						nextSegment: false,
					});
				} else {
					setAutocompleteHint(null);
				}
			} else {
				AssertNever(chatCommandHintBehavior);
			}
		} else {
			setAutocompleteHint(null);
		}
	});

	const actualRef = useTextFormattingOnKeyboardEvent(ref);
	useInputAutofocus(actualRef);

	return (
		<textarea
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			onChange={ onChange }
			maxLength={ LIMIT_DIRECT_MESSAGE_LENGTH }
			placeholder={ `> Send message to ${info.displayName ?? '[Loading ...]'} (${chat.id}) or use a /command` }
		/>
	);
}

const DirectChannelInput = React.forwardRef(DirectChannelInputImpl);
