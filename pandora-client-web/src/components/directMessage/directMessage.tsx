import { IDirectoryAccountInfo, IDirectoryDirectMessageAccount, LIMIT_DIRECT_MESSAGE_LENGTH } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAutoScroll } from '../../common/useAutoScroll';
import { useEvent } from '../../common/useEvent';
import { DirectMessage } from '../../networking/directMessageManager';
import { useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { RenderChatPart } from '../../ui/components/chat/chatMessages';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { DirectMessageChannelProvider, useDirectMessageChannel } from '../gameContext/directMessageChannelProvieder';
import { useCurrentAccount, useDirectoryConnector, useAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import './directMessage.scss';
import { useTextFormattingOnKeyboardEvent } from '../../common/useTextFormattingOnKeyboardEvent';
import classNames from 'classnames';
import { AutoCompleteHint, IChatInputHandler, chatInputContext, useChatInput } from '../../ui/components/chat/chatInput';
import { DIRECT_MESSAGE_COMMANDS, DirectMessageCommandExecutionContext } from './directMessageCommandContext';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { useGameStateOptional } from '../gameContext/gameStateContextProvider';
import { useNavigate } from 'react-router';
import { AutocompleteDisplayData, COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, ICommandInvokeContext, RunCommand } from '../../ui/components/chat/commandsProcessor';
import { useInputAutofocus } from '../../common/userInteraction/inputAutofocus';

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
	const channel = useDirectMessageChannel();
	const channelAccount = channel.account;
	const messages = useObservable(channel.messages);
	const account = useCurrentAccount();
	const [ref] = useAutoScroll<HTMLDivElement>([messages]);

	if (!account || !channelAccount) {
		return null;
	}

	return (
		<Scrollbar
			ref={ ref }
			color='dark'
			className={ classNames(
				'direct-message-list',
				`fontSize-${interfaceChatroomChatFontSize}`,
			) }
		>
			{ messages.map((message) => (
				<DirectMessageElement key={ message.time } message={ message } channel={ channelAccount } account={ account } />
			)) }
		</Scrollbar>
	);
}

function useDirectMessageCommandContext(displayError: boolean): ICommandInvokeContext<DirectMessageCommandExecutionContext> {
	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	const gameState = useGameStateOptional();
	const channel = useDirectMessageChannel();
	const navigate = useNavigate();

	return useMemo(() => ({
		directoryConnector,
		shardConnector,
		gameState,
		channel,
		navigate,
		displayError: displayError ? (message) => toast(message, TOAST_OPTIONS_ERROR) : undefined,
	}), [directoryConnector, shardConnector, gameState, channel, navigate, displayError]);
}

function DirectMessageAutoCompleteHint(): ReactElement | null {
	const ctx = useDirectMessageCommandContext(false);

	return (
		<AutoCompleteHint ctx={ ctx } commands={ DIRECT_MESSAGE_COMMANDS } />
	);
}

function DirectMessageElement({ message, channel, account }: { message: DirectMessage; channel: Readonly<IDirectoryDirectMessageAccount>; account: IDirectoryAccountInfo; }): ReactElement {
	const displayNameElement = useMemo(() => {
		const { labelColor, displayName } = !message.sent ? channel : {
			labelColor: account.settings.labelColor,
			displayName: account.displayName,
		};

		return (
			<span style={ { color: labelColor } } className='direct-message-entry__name'>
				{ displayName }
			</span>
		);
	}, [message, account, channel]);
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
			<span className='direct-message-entry__content'>
				{ ...message.message.map((c, i) => RenderChatPart(c, i, true)) }
			</span>
		</div>
	);
}

function DirectChannelInputImpl(_: unknown, ref: React.ForwardedRef<HTMLTextAreaElement>): ReactElement | null {
	const ctx = useDirectMessageCommandContext(true);
	const channel = ctx.channel;
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
			channel.sendMessage(input, editing?.target)
				.catch((e) => toast(`Failed to send message: ${e as string}`, TOAST_OPTIONS_ERROR));

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

	if (!channel.account) {
		return null;
	}

	return (
		<textarea
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			onChange={ onChange }
			maxLength={ LIMIT_DIRECT_MESSAGE_LENGTH }
			placeholder={ `> Send message to ${channel.account.displayName} (${channel.account.id}) or /command` }
		/>
	);
}

const DirectChannelInput = React.forwardRef(DirectChannelInputImpl);
