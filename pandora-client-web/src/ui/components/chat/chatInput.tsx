import classNames from 'classnames';
import { clamp } from 'lodash-es';
import { AssertNever, AssertNotNullable, CHARACTER_SETTINGS_DEFAULT, CharacterId, ChatCharacterStatus, EMPTY_ARRAY, GetLogger, IChatType, ICommandExecutionContext, SpaceIdSchema, ZodTransformReadonly } from 'pandora-common';
import React, { createContext, ForwardedRef, forwardRef, ReactElement, ReactNode, RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { z } from 'zod';
import settingsIcon from '../../../assets/icons/setting.svg';
import { BrowserStorage } from '../../../browserStorage.ts';
import { Character } from '../../../character/character.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { useTextFormattingOnKeyboardEvent } from '../../../common/useTextFormattingOnKeyboardEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { ChatSendError, IMessageParseOptions, useChatCharacterStatus, useChatMessageSender, useChatSetPlayerStatus, useGameState, useGameStateOptional, useGlobalState, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { useCharacterSettings, usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider.tsx';
import { useNullableObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useService } from '../../../services/serviceProvider.tsx';
import { COMMANDS, GetChatModeDescription } from './commands.ts';
import { AutocompleteDisplayData, COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, IClientCommand, ICommandExecutionContextClient, ICommandInvokeContext, RunCommand } from './commandsProcessor.ts';

type Editing = {
	target: number;
	restore: IMessageParseOptions;
};

export type IChatInputHandler = {
	setValue: (value: string) => void;
	target: Character | null;
	setTarget: (target: CharacterId | null) => void;
	editing: Editing | null;
	setEditing: (editing: number | null) => boolean;
	autocompleteHint: AutocompleteDisplayData | null;
	setAutocompleteHint: (hint: AutocompleteDisplayData | null) => void;
	mode: ChatMode | null;
	setMode: (mode: ChatMode | null) => void;
	showSelector: boolean;
	setShowSelector: (show: boolean) => void;
	allowCommands: boolean;
	ref: RefObject<HTMLTextAreaElement | null>;
};

export const chatInputContext = createContext<IChatInputHandler | null>(null);

const ChatInputSaveSchema = z.object({
	input: z.string(),
	spaceId: SpaceIdSchema.nullable(),
});
type ChatInputSave = z.infer<typeof ChatInputSaveSchema>;
const InputRestore = BrowserStorage.createSession<ChatInputSave>('saveChatInput', { input: '', spaceId: null }, ChatInputSaveSchema);
/** List of recently sent chat messages (both commands and actually sent). Newest is first. */
const InputHistory = BrowserStorage.createSession<readonly string[]>('saveChatInputHistory', EMPTY_ARRAY, z.string().array().transform(ZodTransformReadonly));
/** How many last sent messages are remembered in the session storage */
const INPUT_HISTORY_MAX_LENGTH = 64;

export type ChatMode = {
	type: IChatType;
	raw: boolean;
};

export function ChatInputContextProvider({ children }: { children: React.ReactNode; }) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [target, setTarget] = useState<Character | null>(null);
	const [editing, setEditingState] = useState<Editing | null>(null);
	const [autocompleteHint, setAutocompleteHint] = useState<AutocompleteDisplayData | null>(null);
	const [mode, setMode] = useState<ChatMode | null>(null);
	const [showSelector, setShowSelector] = useState(false);
	const gameState = useGameStateOptional();
	const characters = useSpaceCharacters();
	const playerId = usePlayerId();
	const spaceId = useNullableObservable(gameState?.currentSpace)?.id ?? null;

	useEffect(() => {
		if (!spaceId)
			return;

		if (spaceId !== InputRestore.value.spaceId) {
			InputRestore.value = { input: '', spaceId };
		}
	}, [spaceId]);

	const setEditing = useEvent((edit: Editing | null) => {
		setEditingState(edit);
		if (!edit) {
			ref.current?.focus();
			return true;
		}
		const editingMessage = gameState?.getMessageEdit(edit?.target);
		if (!editingMessage) return false;
		const { text, options } = editingMessage;
		if (!text) {
			return false;
		}
		if (options.target) {
			const targetCharacter = characters?.find((c) => c.data.id === options.target);
			if (targetCharacter) {
				setTarget(targetCharacter);
			} else {
				toast(`Character ${options.target} not found`, TOAST_OPTIONS_ERROR);
			}
		}
		if (options.type) {
			setMode({ type: options.type, raw: options.raw ?? false });
		}
		if (ref.current) {
			ref.current.value = text;
			ref.current.focus();
		}
		return true;
	});

	// Handler to autofocus chat input
	useInputAutofocus(ref);

	const context = useMemo((): IChatInputHandler => {
		const newSetTarget = (t: CharacterId | null) => {
			if (t === playerId) {
				return;
			}
			setTarget(!t ? null : characters?.find((c) => c.data.id === t) ?? null);
		};
		return {
			setValue: (value: string) => {
				if (ref.current) {
					ref.current.value = value;
				}
				InputRestore.value = { input: value, spaceId: InputRestore.value.spaceId };
			},
			target,
			setTarget: newSetTarget,
			editing,
			setEditing: (edit: number | null): boolean => {
				if (edit === null) {
					if (editing === null)
						return setEditing(null);

					newSetTarget(editing?.restore.target ?? null);
					setMode(editing?.restore.type ? { type: editing.restore.type, raw: editing.restore.raw ?? false } : null);
					return setEditing(null);
				} else if (editing)
					return setEditing({ target: edit, restore: editing.restore });
				else
					return setEditing({ target: edit, restore: { target: target?.data.id, type: mode?.type, raw: mode?.raw } });
			},
			autocompleteHint,
			setAutocompleteHint,
			mode,
			setMode,
			showSelector,
			setShowSelector,
			allowCommands: editing == null && !mode?.raw,
			ref,
		};
	}, [target, editing, setEditing, autocompleteHint, showSelector, setShowSelector, playerId, characters, mode]);

	return (
		<chatInputContext.Provider value={ context }>
			{ children }
		</chatInputContext.Provider>
	);
}

export function ChatInputArea({ messagesDiv, scroll, newMessageCount }: { messagesDiv: RefObject<HTMLDivElement | null>; scroll: (forceScroll: boolean) => void; newMessageCount: number; }) {
	const { ref, mode, editing } = useChatInput();
	const modeRef = useRef<typeof mode | null>(null);
	const editingRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (editing?.target !== editingRef.current) {
			editingRef.current = editing?.target;
			if (editing) {
				const node = document.querySelector('.chatArea .message.editing');
				node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				return;
			}
		}
		if (modeRef.current !== mode) {
			modeRef.current = mode;
			if (!editing)
				scroll(true);
		}
	}, [mode, editing, scroll]);

	return (
		<>
			<UnreadMessagesIndicator newMessageCount={ newMessageCount } scroll={ scroll } />
			<TypingIndicator />
			<Modifiers scroll={ scroll } />
			<ChatModeSelector />
			<TextArea ref={ ref } messagesDiv={ messagesDiv } scrollMessagesView={ scroll } />
		</>
	);
}

function TextAreaImpl({ messagesDiv, scrollMessagesView }: {
	messagesDiv: RefObject<HTMLDivElement | null>;
	scrollMessagesView: (forceScroll: boolean) => void;
}, ref: ForwardedRef<HTMLTextAreaElement>) {
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const setPlayerStatus = useChatSetPlayerStatus();
	const sender = useChatMessageSender();
	const chatInput = useChatInput();
	const { target, editing, setEditing, setValue, setAutocompleteHint, mode, allowCommands } = chatInput;
	const { chatCommandHintBehavior } = useAccountSettings();

	const shardConnector = useShardConnector();
	AssertNotNullable(shardConnector);

	/**
	 * Index of currently selected "recently sent" message.
	 * -1 for when writing a new message.
	 * @see InputHistory
	 */
	const inputHistoryIndex = useRef(-1);

	const commandInvokeContext = useChatCommandContext();

	const inputEnd = useEvent(() => {
		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = null;
		}
		setPlayerStatus('none');
	});

	const updateCommandHelp = useEvent((textarea: HTMLTextAreaElement) => {
		let input = textarea.value;
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			input = input.slice(1, textarea.selectionStart || textarea.value.length);

			const autocompleteResult = CommandAutocomplete(input, commandInvokeContext, COMMANDS);

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

	const handleSend = useCallback((input: string, forceOOC: boolean): boolean => {
		setAutocompleteHint(null);
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			// Process command
			return RunCommand(input.slice(1), commandInvokeContext, COMMANDS);
		} else {
			// Double command key escapes itself
			if (input.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
				input = input.slice(1);
			}
			input = input.trim();
			// Ignore empty input, unless editing
			if (editing == null && !input) {
				return false;
			}
			// TODO ... all options
			sender.sendMessage(input, {
				target: target?.data.id,
				editing: editing?.target || undefined,
				type: mode?.type || (forceOOC ? 'ooc' : undefined),
				raw: mode?.raw || undefined,
			});
			return true;
		}
	}, [allowCommands, commandInvokeContext, editing, mode, sender, setAutocompleteHint, target]);

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		const input = textarea.value;
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				if (handleSend(input, ev.altKey)) {
					textarea.value = '';
					inputHistoryIndex.current = -1;
					setEditing(null);

					if (input && (InputHistory.value.length === 0 || InputHistory.value[0] !== input)) {
						InputHistory.produceImmer((arr) => {
							arr.unshift(input);
							if (arr.length > INPUT_HISTORY_MAX_LENGTH) {
								arr.splice(INPUT_HISTORY_MAX_LENGTH, arr.length - INPUT_HISTORY_MAX_LENGTH);
							}
						});
					}
				}
			} catch (error) {
				if (error instanceof ChatSendError) {
					toast(
						<span className='display-linebreak'>
							This message cannot be sent:<br />
							{ error.reason }
						</span>,
						TOAST_OPTIONS_WARNING,
					);
				} else {
					toast('Error sending chat message', TOAST_OPTIONS_ERROR);
					GetLogger('ChatInput').error('Error sending message:', error);
				}
			}
		} else if (ev.key === 'Tab' && textarea.value.startsWith(COMMAND_KEY) && !textarea.value.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				// Process command
				const inputPosition = textarea.selectionStart || textarea.value.length;
				const command = textarea.value.slice(1, textarea.selectionStart);

				const autocompleteResult = CommandAutocompleteCycle(command, commandInvokeContext, COMMANDS, ev.shiftKey);

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
		} else if (ev.key === 'ArrowUp' && !textarea.value.trim()) {
			ev.preventDefault();
			ev.stopPropagation();
			const edit = sender.getLastMessageEdit();
			if (edit) {
				setEditing(edit);
			}
		} else if ((ev.key === 'PageUp' || ev.key === 'PageDown') && ev.shiftKey) {
			// On PageUp/Down with shift we scroll chat window
			ev.preventDefault();
			ev.stopPropagation();

			if (messagesDiv.current) {
				messagesDiv.current.scrollTo({
					top: clamp(
						messagesDiv.current.scrollTop + Math.round((ev.key === 'PageUp' ? -0.5 : 0.5) * messagesDiv.current.clientHeight),
						0,
						messagesDiv.current.scrollHeight,
					),
					behavior: 'smooth',
				});
			}
		} else if (ev.key === 'PageUp' && !ev.shiftKey) {
			// On page up without shift, we show the previous sent message
			ev.preventDefault();
			ev.stopPropagation();

			if (inputHistoryIndex.current + 1 < InputHistory.value.length) {
				// Save the current input, if it has been modified
				if (input && inputHistoryIndex.current < 0) {
					InputHistory.produceImmer((arr) => {
						arr.unshift(input);
					});
					inputHistoryIndex.current = 0;
				} else if (input && InputHistory.value[inputHistoryIndex.current] !== input) {
					InputHistory.produceImmer((arr) => {
						arr.splice(inputHistoryIndex.current, 0, input);
					});
				}

				// Replace current value with one from history
				inputHistoryIndex.current++;
				textarea.value = InputHistory.value[inputHistoryIndex.current];
			}
		} else if (ev.key === 'PageDown' && !ev.shiftKey) {
			// On page down without shift, we show the next sent message (after going to previous)
			ev.preventDefault();
			ev.stopPropagation();

			if (inputHistoryIndex.current >= 0) {
				// Save the current input, if it has been modified
				if (input !== '' && InputHistory.value[inputHistoryIndex.current] !== input) {
					InputHistory.produceImmer((arr) => {
						arr.splice(inputHistoryIndex.current, 0, input);
					});
				}

				// Replace current value with one from history
				inputHistoryIndex.current--;
				textarea.value = inputHistoryIndex.current < 0 ? '' : InputHistory.value[inputHistoryIndex.current];
			}
		} else if (ev.key === 'Escape') {
			ev.preventDefault();
			ev.stopPropagation();

			if (editing) {
				// When editing, Esc cancels editing
				setEditing(null);
				setValue('');
			} else {
				// Otherwise scroll to end of messages view
				scrollMessagesView(true);
			}
		}

		// After running the whole handler update the typing status and saved restore state
		updateTypingStatus(textarea);
	});

	const updateTypingStatus = (textarea: HTMLTextAreaElement) => {
		const value = textarea.value;
		InputRestore.value = { input: value, spaceId: InputRestore.value.spaceId };

		let nextStatus: null | { status: ChatCharacterStatus; target?: CharacterId; } = null;
		const trimmed = value.trim();
		// Only start showing typing indicator once user wrote at least three characters and do not show it for commands
		if (trimmed.length >= 3 && (!value.startsWith(COMMAND_KEY) || value.startsWith(COMMAND_KEY + COMMAND_KEY) || !allowCommands)) {
			nextStatus = { status: target ? 'whispering' : 'typing', target: target?.data.id };
		} else {
			nextStatus = { status: 'none' };
		}

		if (nextStatus.status === 'none') {
			inputEnd();
			return;
		}

		setPlayerStatus(nextStatus.status, nextStatus.target);

		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = null;
		}
		timeout.current = setTimeout(() => inputEnd(), 3_000);
	};

	const onChange = useEvent((ev: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = ev.target;
		updateCommandHelp(textarea);
		updateTypingStatus(textarea);
	});

	useEffect(() => () => inputEnd(), [inputEnd]);
	const actualRef = useTextFormattingOnKeyboardEvent(ref);

	return (
		<textarea
			placeholder='> Type message or /command'
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			onChange={ onChange }
			onBlur={ inputEnd }
			defaultValue={ InputRestore.value.input }
		/>
	);
}

const TextArea = forwardRef(TextAreaImpl);

export function useChatInput(): IChatInputHandler {
	const context = useContext(chatInputContext);
	AssertNotNullable(context);
	return context;
}

function TypingIndicator(): ReactElement {
	let statuses = useChatCharacterStatus();
	const playerId = usePlayerId();
	const { showSelector, setShowSelector } = useChatInput();

	const onClick = useCallback((ev: React.MouseEvent<HTMLDivElement>) => {
		ev.stopPropagation();
		setShowSelector(!showSelector);
	}, [showSelector, setShowSelector]);

	statuses = statuses.filter((s) => s.data.id !== playerId && (s.status === 'typing' || s.status === 'whispering'));

	const extra: ReactNode[] = [];
	if (statuses.filter((s) => s.status === 'typing').length > 3) {
		statuses = statuses.filter((s) => s.status !== 'typing');
		extra.push(<span key='extra-multiple-typing'>Multiple people are typing</span>);
	}

	return (
		<div className='typing-indicator' onClick={ onClick }>
			<Row className='flex-1' wrap>
				{ statuses.map(({ data, status }) => (
					<span key={ data.id }>
						<span style={ { color: data.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } }>{ data.name } </span>
						({ data.id })
						{ ' is ' }
						{ status }
					</span>
				)) }
				{ extra }
			</Row>
			<img src={ settingsIcon } alt={ 'Change chat mode' } />
		</div>
	);
}

function UnreadMessagesIndicator({ newMessageCount, scroll }: { newMessageCount: number; scroll: (forceScroll: boolean) => void; }): ReactElement | null {
	if (newMessageCount === 0) {
		return null;
	}

	const indicatorText = `Unread chat message${newMessageCount > 1 ? `s (${newMessageCount})` : ''}`;

	return (
		<button className='unread-messages-indicator' onClick={ () => scroll(true) }>
			<Row padding='medium' className='flex-1' alignX='space-between'>
				<span>{ indicatorText }</span>
				<span>Click to scroll to the end</span>
			</Row>
		</button>
	);
}

function Modifiers({ scroll }: { scroll: (forceScroll: boolean) => void; }): ReactElement {
	const { target, setTarget, editing, setEditing, setValue, mode, setMode } = useChatInput();
	const lastHasTarget = useRef(target !== null);
	const lastEditing = useRef(editing);

	useEffect(() => {
		if (lastHasTarget.current !== (target !== null) || lastEditing.current !== editing) {
			scroll(false);
			lastHasTarget.current = target !== null;
			lastEditing.current = editing;
		}
	}, [target, editing, scroll]);

	return (
		<div className='input-modifiers'>
			{ target && (
				<span>
					{ 'Whispering to ' }
					<span style={ { color: target.data.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } }>{ target.data.name }</span>
					{ ' ' }
					({ target.data.id })
					{ ' ' }
					{ editing === null && (
						<Button className='slim' onClick={ (ev) => {
							ev.stopPropagation();
							setTarget(null);
						} }>Cancel
						</Button>
					) }
				</span>
			) }
			{ editing && (
				<span>
					<span style={ { color: '#8cf' } }>{ 'Editing message ' }</span>
					<Button className='slim' onClick={ (ev) => {
						ev.stopPropagation();
						setEditing(null);
						setValue('');
					} }>
						Cancel
					</Button>
				</span>
			) }
			{ mode && (
				<span>
					{ 'Sending ' }
					{ GetChatModeDescription(mode, true) }
					{ ' ' }
					<Button className='slim' onClick={ (ev) => {
						ev.stopPropagation();
						setMode(null);
					} }>
						Cancel
					</Button>
				</span>
			) }
		</div>
	);
}

export function useChatCommandContext(): ICommandInvokeContext<ICommandExecutionContextClient> {
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const sender = useChatMessageSender();
	const chatInput = useChatInput();
	const accountSettings = useAccountSettings();
	const characterSettings = useCharacterSettings();

	const directoryConnector = useDirectoryConnector();
	const accountManager = useService('accountManager');
	const shardConnector = useShardConnector();
	const navigate = useNavigatePandora();
	AssertNotNullable(shardConnector);

	return useMemo((): ICommandInvokeContext<ICommandExecutionContextClient> => ({
		displayError(error) {
			toast(error, TOAST_OPTIONS_ERROR);
		},
		shardConnector,
		directoryConnector,
		accountManager,
		gameState,
		globalState,
		player: gameState.player,
		accountSettings,
		characterSettings,
		messageSender: sender,
		inputHandlerContext: chatInput,
		navigate,
	}), [chatInput, gameState, globalState, accountSettings, characterSettings, directoryConnector, accountManager, navigate, sender, shardConnector]);
}

export function AutoCompleteHint<TCommandExecutionContext extends ICommandExecutionContext>({ ctx, commands }: {
	ctx: ICommandInvokeContext<TCommandExecutionContext>;
	commands: readonly IClientCommand<TCommandExecutionContext>[];
}): ReactElement | null {
	const { autocompleteHint, ref, setAutocompleteHint, allowCommands } = useChatInput();
	const { chatCommandHintBehavior } = useAccountSettings();
	const selectedElementRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (autocompleteHint?.index != null && selectedElementRef.current != null) {
			selectedElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [autocompleteHint?.index]);

	if (!autocompleteHint?.result || !allowCommands)
		return null;

	// When only one command can/should be displayed, onlyShowOption is set to that command's index in the option array
	let longDescriptionOption: number | null = null;
	if (autocompleteHint.index != null) {
		longDescriptionOption = autocompleteHint.index;
	} else if (autocompleteHint.result.options.length === 1) {
		longDescriptionOption = 0;
	} else if (ref.current) {
		longDescriptionOption = autocompleteHint.result.options.findIndex((option) => COMMAND_KEY + option.replaceValue === ref.current?.value);
	}
	if (longDescriptionOption != null && !autocompleteHint.result.options[longDescriptionOption]?.longDescription) {
		longDescriptionOption = null;
	}

	return (
		<div className='autocomplete-hint'>
			{ autocompleteHint.result.header }
			{
				autocompleteHint.result.options.length > 0 &&
				<>
					<hr />
					<Scrollable className='flex-1'>
						<Column gap='tiny'>
							{
								autocompleteHint.result.options.map((option, index) => (
									<span key={ index }
										className={ classNames({ selected: index === autocompleteHint.index }) }
										ref={ index === autocompleteHint.index ? selectedElementRef : undefined }
										onClick={ (ev) => {
											const textarea = ref.current;
											if (!textarea)
												return;

											ev.preventDefault();
											ev.stopPropagation();

											const inputPosition = textarea.selectionStart || textarea.value.length;
											const input = option.replaceValue + ' ';

											textarea.value = COMMAND_KEY + input + textarea.value.slice(inputPosition).trimStart();
											textarea.focus();
											textarea.setSelectionRange(input.length + 1, input.length + 1, 'none');

											const autocompleteResult: AutocompleteDisplayData = {
												replace: textarea.value,
												result: CommandAutocomplete(input, ctx, commands),
												index: null,
												nextSegment: true,
											};

											if (chatCommandHintBehavior === 'always-show') {
												setAutocompleteHint(autocompleteResult);
											} else if (chatCommandHintBehavior === 'on-tab') {
												setAutocompleteHint(autocompleteResult.nextSegment ? null : autocompleteResult);
											} else {
												AssertNever(chatCommandHintBehavior);
											}
										} }
									>
										{ option.displayValue }
									</span>
								))
							}
						</Column>
					</Scrollable>
				</>
			}
			{
				longDescriptionOption != null ? (
					<>
						<hr />
						{ autocompleteHint.result.options[longDescriptionOption]?.longDescription }
					</>
				) : null
			}
		</div>
	);
}

function ChatModeSelector(): ReactElement | null {
	const { setMode, mode, showSelector, setShowSelector, target } = useChatInput();
	const ref = useRef<HTMLSelectElement>(null);
	const hasTarget = target !== null;

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>((ev) => {
		let value = ev.target.value;
		if (value === '') {
			setMode(null);
			setShowSelector(false);
			return;
		}
		let raw = false;
		if (value.startsWith('raw_')) {
			raw = true;
			value = value.slice(4);
		}
		setMode({ type: value as IChatType, raw });
		setShowSelector(false);
	}, [setMode, setShowSelector]);

	useEffect(() => {
		const handler = (ev: MouseEvent) => {
			if (!showSelector || ref.current == null || ref.current.contains(ev.target as Node) || ev.target === ref.current)
				return;

			setShowSelector(false);
		};
		window.addEventListener('click', handler);
		return () => window.removeEventListener('click', handler);
	}, [setShowSelector, showSelector]);

	if (!showSelector)
		return null;

	return (
		<Select onChange={ onChange } ref={ ref } defaultValue={ mode ? ((mode.raw ? 'raw_' : '') + mode.type) : '' }>
			<option value=''>
				Chat mode: Normal Chat
			</option>
			<option value='raw_chat'>
				Chat mode: Chat (without formatting)
			</option>
			<option value='me' disabled={ hasTarget }>
				Chat mode: Me
			</option>
			<option value='raw_me' disabled={ hasTarget }>
				Chat mode: Me (without formatting)
			</option>
			<option value='emote' disabled={ hasTarget }>
				Chat mode: Emote
			</option>
			<option value='raw_emote' disabled={ hasTarget }>
				Chat mode: Emote (without formatting)
			</option>
			<option value='ooc'>
				Chat mode: OOC
			</option>
			<option value='raw_ooc'>
				Chat mode: OOC (without formatting)
			</option>
		</Select>
	);
}
