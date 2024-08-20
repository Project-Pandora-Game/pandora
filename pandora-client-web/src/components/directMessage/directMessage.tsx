import classNames from 'classnames';
import type { Immutable } from 'immer';
import { GetLogger, IDirectoryAccountInfo, LIMIT_DIRECT_MESSAGE_LENGTH, LIMIT_DIRECT_MESSAGE_LENGTH_BASE64 } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import { useAutoScroll } from '../../common/useAutoScroll';
import { useEvent } from '../../common/useEvent';
import { useTextFormattingOnKeyboardEvent } from '../../common/useTextFormattingOnKeyboardEvent';
import { useInputAutofocus } from '../../common/userInteraction/inputAutofocus';
import { useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks';
import type { LoadedDirectMessage } from '../../services/accountLogic/directMessages/directMessageChat';
import { AutoCompleteHint, IChatInputHandler, chatInputContext, useChatInput } from '../../ui/components/chat/chatInput';
import { RenderChatPart } from '../../ui/components/chat/chatMessages';
import { AutocompleteDisplayData, COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, ICommandInvokeContext, RunCommand } from '../../ui/components/chat/commandsProcessor';
import { Column } from '../common/container/container';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { DirectMessageChannelProvider, useDirectMessageChat } from '../gameContext/directMessageChannelProvieder';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useGameStateOptional } from '../gameContext/gameStateContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import './directMessage.scss';
import { DIRECT_MESSAGE_COMMANDS, DirectMessageCommandExecutionContext } from './directMessageCommandContext';

export function DirectMessage({ accountId }: { accountId: number; }): ReactElement {
	const ref = React.useRef<HTMLTextAreaElement>(null);
	const [autocompleteHint, setAutocompleteHint] = React.useState<AutocompleteDisplayData | null>(null);

	const ctx = React.useMemo((): IChatInputHandler => ({
		setValue: (value: string) => {
			if (ref.current) {
				ref.current.value = value;
			}
		},
		target: null,
		setTarget: () => { /** */ },
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

	return (
		<div className='direct-message'>
			<chatInputContext.Provider value={ ctx }>
				<DirectMessageChannelProvider accountId={ accountId }>
					<DirectMessageList />
					<DirectMessageAutoCompleteHint />
					<DirectChannelInput ref={ ref } />
				</DirectMessageChannelProvider>
			</chatInputContext.Provider>
		</div>
	);
}

function DirectMessageList(): ReactElement | null {
	const { interfaceChatroomChatFontSize } = useAccountSettings();
	const { chat } = useDirectMessageChat();
	const encryptedMessages = useObservable(chat.messages);
	const account = useCurrentAccount();
	const [ref] = useAutoScroll<HTMLDivElement>([encryptedMessages]);

	if (!account) {
		return null;
	}

	return (
		<div
			className={ classNames(
				'direct-message-list',
				`fontSize-${interfaceChatroomChatFontSize}`,
			) }
		>
			<Scrollable
				ref={ ref }
				color='dark'
				className='fill'
				tabIndex={ 1 }
			>
				<Column gap='none'>
					{ encryptedMessages.map((message) => (
						<DirectMessageElement
							key={ message.time }
							message={ message }
							currentAccount={ account }
						/>
					)) }
				</Column>
			</Scrollable>
		</div>
	);
}

function useDirectMessageCommandContext(displayError: boolean): ICommandInvokeContext<DirectMessageCommandExecutionContext> {
	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	const gameState = useGameStateOptional();
	const { chat, encryption } = useDirectMessageChat();
	const navigate = useNavigate();

	const sendMessage = useCallback<DirectMessageCommandExecutionContext['sendMessage']>(async (message, editing) => {
		const encrypted = message.length === 0 ? '' : await encryption.service.encrypt(message);
		if (encrypted.length > LIMIT_DIRECT_MESSAGE_LENGTH_BASE64) {
			toast(`Encrypted message too long: ${encrypted.length} > ${LIMIT_DIRECT_MESSAGE_LENGTH_BASE64}`, TOAST_OPTIONS_ERROR);
			return;
		}
		const response = await directoryConnector.awaitResponse('sendDirectMessage', { id: chat.id, content: encrypted, editing });
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
			displayName: displayInfo.displayName,
		};

		return (
			<span style={ { color: labelColor } } className='direct-message-entry__name'>
				{ displayName }
			</span>
		);
	}, [message, currentAccount, accountLabelColor, displayInfo]);
	const time = useMemo(() => new Date(message.time), [message.time]);

	return (
		<div className='direct-message-entry'>
			<span className='direct-message-entry__info'>
				<time>
					{ time.toLocaleDateString() } { time.toLocaleTimeString('en-IE').substring(0, 5) }
				</time>
				{ message.edited ? <span> [edited]</span> : null }
				{ /* Space so copied text looks nicer */ ' ' }
			</span>
			{ displayNameElement }
			{ ': ' }
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
			<span className='direct-message-entry__content'>
				<span className='error'>[ Unable to decrypt message created with a different key ]</span>
			</span>
		);
	} else if (error === 'error') {
		return (
			<span className='direct-message-entry__content'>
				<span className='error'>[ ERROR: Failed to decrypt the message ]</span>
			</span>
		);
	} else if (message.decrypted == null) {
		return (
			<span className='direct-message-entry__content'>
				[ <i>Decrypting...</i> ] <br />
				{ message.content }
			</span>
		);
	}

	return (
		<span className='direct-message-entry__content'>
			{ ...message.decrypted.map((c, i) => RenderChatPart(c, i, true)) }
		</span>
	);
}

function DirectChannelInputImpl(_: unknown, ref: React.ForwardedRef<HTMLTextAreaElement>): ReactElement | null {
	const ctx = useDirectMessageCommandContext(true);
	const chat = ctx.chat;
	const info = useObservable(chat.displayInfo);
	const { editing, setEditing, setAutocompleteHint, allowCommands } = useChatInput();

	const handleSend = (input: string) => {
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
				if (handleSend(input)) {
					textarea.value = '';
					setEditing(null);
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
				setAutocompleteHint(autocompleteResult);

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

			setAutocompleteHint({
				replace: textarea.value,
				result: autocompleteResult,
				index: null,
			});
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
