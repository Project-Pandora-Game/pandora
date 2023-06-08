import { AssertNotNullable, CharacterId, EMPTY_ARRAY, IChatRoomStatus, IChatType, RoomId, ZodTransformReadonly } from 'pandora-common';
import React, { createContext, ForwardedRef, forwardRef, ReactElement, ReactNode, RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clamp, noop } from 'lodash';
import { Character } from '../../character/character';
import { IMessageParseOptions, useChatRoomCharacters, useChatRoomInfo, useChatRoomMessageSender, useChatroomRequired, useChatRoomSetPlayerStatus, useChatRoomStatus } from '../gameContext/chatRoomContextProvider';
import { useEvent } from '../../common/useEvent';
import { AutocompleteDisplyData, CommandAutocomplete, CommandAutocompleteCycle, COMMAND_KEY, RunCommand, ICommandInvokeContext } from './commandsProcessor';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { Button } from '../common/button/button';
import { usePlayerId } from '../gameContext/playerContextProvider';
import './chatroom.scss';
import { BrowserStorage } from '../../browserStorage';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import classNames from 'classnames';
import { Row } from '../common/container/container';
import { GetChatModeDescription } from './commands';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { Select } from '../common/select/select';
import settingsIcon from '../../assets/icons/setting.svg';
import { z } from 'zod';

type Editing = {
	target: number;
	restore: IMessageParseOptions;
};

export type IChatInputHandler = {
	focus: () => void;
	setValue: (value: string) => void;
	target: Character | null;
	setTarget: (target: CharacterId | null) => void;
	editing: Editing | null;
	setEditing: (editing: number | null) => boolean;
	autocompleteHint: AutocompleteDisplyData | null;
	setAutocompleteHint: (hint: AutocompleteDisplyData | null) => void;
	mode: ChatMode | null;
	setMode: (mode: ChatMode | null) => void;
	showSelector: boolean;
	setShowSelector: (show: boolean) => void;
	allowCommands: boolean;
	ref: RefObject<HTMLTextAreaElement>;
};

const chatInputContext = createContext<IChatInputHandler>({
	focus: noop,
	setValue: noop,
	target: null,
	setTarget: noop,
	editing: null,
	setEditing: () => false,
	autocompleteHint: null,
	setAutocompleteHint: noop,
	mode: null,
	setMode: noop,
	showSelector: false,
	setShowSelector: noop,
	allowCommands: true,
	ref: null as unknown as RefObject<HTMLTextAreaElement>,
});

type ChatInputSave = {
	input: string;
	roomId: RoomId | null;
};
const InputRestore = BrowserStorage.createSession<ChatInputSave>('saveChatInput', { input: '', roomId: null });
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
	const [autocompleteHint, setAutocompleteHint] = useState<AutocompleteDisplyData | null>(null);
	const [mode, setMode] = useState<ChatMode | null>(null);
	const [showSelector, setShowSelector] = useState(false);
	const characters = useChatRoomCharacters();
	const sender = useChatRoomMessageSender();
	const playerId = usePlayerId();
	const roomId = useChatRoomInfo()?.id;

	useEffect(() => {
		if (!roomId)
			return;

		if (roomId !== InputRestore.value.roomId) {
			InputRestore.value = { input: '', roomId };
		}
	}, [roomId]);

	const setEditing = useEvent((edit: Editing | null) => {
		setEditingState(edit);
		if (!edit) {
			ref.current?.focus();
			return true;
		}
		const editingMessage = sender.getMessageEdit(edit?.target);
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
	useEffect(() => {
		const keyPressHandler = (ev: KeyboardEvent) => {
			if (
				ref.current &&
				// Only if no other input is selected
				(!document.activeElement || !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) &&
				// Only if this isn't a special key or key combo
				!ev.ctrlKey &&
				!ev.metaKey &&
				!ev.altKey &&
				ev.key.length === 1
			) {
				ref.current.focus();
			}
		};
		window.addEventListener('keypress', keyPressHandler);
		return () => {
			window.removeEventListener('keypress', keyPressHandler);
		};
	}, []);

	const context = useMemo<IChatInputHandler>(() => {
		const newSetTarget = (t: CharacterId | null) => {
			if (t === playerId) {
				return;
			}
			setTarget(!t ? null : characters?.find((c) => c.data.id === t) ?? null);
		};
		return {
			focus: () => ref.current?.focus(),
			setValue: (value: string) => {
				if (ref.current) {
					ref.current.value = value;
				}
				InputRestore.value = { input: value, roomId: InputRestore.value.roomId };
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
	}, [target, editing, setEditing, autocompleteHint, showSelector, setShowSelector, setAutocompleteHint, playerId, characters, mode]);

	return (
		<chatInputContext.Provider value={ context }>
			{ children }
		</chatInputContext.Provider>
	);
}

export function ChatInputArea({ messagesDiv, scroll, newMessageCount }: { messagesDiv: RefObject<HTMLDivElement>; scroll: (forceScroll: boolean) => void; newMessageCount: number; }) {
	const { ref } = useChatInput();
	return (
		<>
			<AutoCompleteHint />
			<UnreadMessagesIndicator newMessageCount={ newMessageCount } scroll={ scroll } />
			<TypingIndicator />
			<Modifiers scroll={ scroll } />
			<ChatModeSelector />
			<TextArea ref={ ref } messagesDiv={ messagesDiv } scrollMessagesView={ scroll } />
		</>
	);
}

function TextAreaImpl({ messagesDiv, scrollMessagesView }: {
	messagesDiv: RefObject<HTMLDivElement>;
	scrollMessagesView: (forceScroll: boolean) => void;
}, ref: ForwardedRef<HTMLTextAreaElement>) {
	const lastInput = useRef('');
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const setPlayerStatus = useChatRoomSetPlayerStatus();
	const chatRoom = useChatroomRequired();
	const sender = useChatRoomMessageSender();
	const chatInput = useChatInput();
	const { target, editing, setEditing, setValue, setAutocompleteHint, mode, allowCommands } = chatInput;

	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	AssertNotNullable(shardConnector);

	/**
	 * Index of currently selected "recently sent" message.
	 * -1 for when writing a new message.
	 * @see InputHistory
	 */
	const inputHistoryIndex = useRef(-1);

	const commandInvokeContext = useMemo<ICommandInvokeContext>(() => ({
		displayError(error) {
			toast(error, TOAST_OPTIONS_ERROR);
		},
		shardConnector,
		directoryConnector,
		chatRoom,
		messageSender: sender,
		inputHandlerContext: chatInput,
	}), [chatInput, chatRoom, directoryConnector, sender, shardConnector]);

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

			const autocompleteResult = CommandAutocomplete(input, commandInvokeContext);

			setAutocompleteHint({
				replace: textarea.value,
				result: autocompleteResult,
				index: null,
			});
		} else {
			setAutocompleteHint(null);
		}
	});

	const handleSend = useCallback((input: string): boolean => {
		setAutocompleteHint(null);
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			// Process command
			return RunCommand(input.slice(1), commandInvokeContext);
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
				type: mode?.type || undefined,
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
				if (handleSend(input)) {
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
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
				}
				return;
			}
		}
		if (ev.key === 'Tab' && textarea.value.startsWith(COMMAND_KEY) && !textarea.value.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				// Process command
				const inputPosition = textarea.selectionStart || textarea.value.length;
				const command = textarea.value.slice(1, textarea.selectionStart);

				const autocompleteResult = CommandAutocompleteCycle(command, commandInvokeContext);

				const replacementStart = COMMAND_KEY + autocompleteResult.replace;

				textarea.value = replacementStart + textarea.value.slice(inputPosition).trimStart();
				textarea.setSelectionRange(replacementStart.length, replacementStart.length, 'none');
				setAutocompleteHint(autocompleteResult);

			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
				}
			}
			return;
		}
		if (ev.key === 'ArrowUp' && !textarea.value.trim()) {
			ev.preventDefault();
			ev.stopPropagation();
			const edit = sender.getLastMessageEdit();
			if (edit) {
				setEditing(edit);
				return;
			}
		}
		// On PageUp/Down with shift we scroll chat window
		if ((ev.key === 'PageUp' || ev.key === 'PageDown') && ev.shiftKey) {
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

			return;
		}

		// On page up without shift, we show the previous sent message
		if (ev.key === 'PageUp' && !ev.shiftKey) {
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
			return;
		}

		// On page down without shift, we show the next sent message (after going to previous)
		if (ev.key === 'PageDown' && !ev.shiftKey) {
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
			return;
		}

		if (ev.key === 'Escape') {
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

			return;
		}

		const value = textarea.value;
		if (value === lastInput.current)
			return;

		lastInput.current = value;
		InputRestore.value = { input: value, roomId: InputRestore.value.roomId };
		let nextStatus: null | { status: IChatRoomStatus; target?: CharacterId; } = null;
		const trimmed = value.trim();
		if (trimmed.length > 0 && (!value.startsWith(COMMAND_KEY) || value.startsWith(COMMAND_KEY + COMMAND_KEY) || !allowCommands)) {
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
	});

	const onChange = useEvent((ev: React.ChangeEvent<HTMLTextAreaElement>) => {
		updateCommandHelp(ev.target);
	});

	useEffect(() => () => inputEnd(), [inputEnd]);

	return <textarea ref={ ref } onKeyDown={ onKeyDown } onChange={ onChange } onBlur={ inputEnd } defaultValue={ InputRestore.value.input } />;
}

const TextArea = forwardRef(TextAreaImpl);

export function useChatInput(): IChatInputHandler {
	return useContext(chatInputContext);
}

function TypingIndicator(): ReactElement {
	let statuses = useChatRoomStatus();
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
						<span style={ { color: data.settings.labelColor } }>{ data.name } </span>
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
			<Row padding='normal' className='flex-1' alignX='space-between'>
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
					<span style={ { color: target.data.settings.labelColor } }>{ target.data.name }</span>
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
					{ 'Editing message ' }
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

function AutoCompleteHint(): ReactElement | null {
	const { autocompleteHint, ref } = useChatInput();

	const chatRoom = useChatroomRequired();
	const sender = useChatRoomMessageSender();
	const chatInput = useChatInput();
	const { setAutocompleteHint, allowCommands } = chatInput;

	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	AssertNotNullable(shardConnector);
	if (!autocompleteHint?.result || !allowCommands)
		return null;

	// When only one command can/should be displayed, onlyShowOption is set to that command's index in the option array
	let onlyShowOption = -1;
	if (autocompleteHint.result.options.length === 1) {
		onlyShowOption = 0;
	} else if (ref.current) {
		onlyShowOption = autocompleteHint.result.options.findIndex((option) => COMMAND_KEY + option.replaceValue === ref.current?.value);
	}
	if (onlyShowOption !== -1 && !autocompleteHint.result.options[onlyShowOption]?.longDescription) {
		onlyShowOption = -1;
	}

	return (
		<div className='autocomplete-hint'>
			<div>
				{ autocompleteHint.result.header }
				{
					autocompleteHint.result.options.length > 0 &&
						<>
							<hr />
							{
								autocompleteHint.result.options.map((option, index) => (
									(onlyShowOption === -1 || onlyShowOption === index) &&
									<span key={ index }
										className={ classNames({ selected: index === autocompleteHint.index }) }
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

											const autocompleteResult = CommandAutocomplete(input, {
												shardConnector,
												directoryConnector,
												chatRoom,
												messageSender: sender,
												inputHandlerContext: chatInput,
											});

											setAutocompleteHint({
												replace: textarea.value,
												result: autocompleteResult,
												index: null,
											});
										} }
									>
										{ option.displayValue }
									</span>
								))
							}
						</>
				}
				{
					onlyShowOption >= 0 &&
						<>
							<hr />
							{ autocompleteHint.result.options[onlyShowOption]?.longDescription }
						</>
				}
			</div>
		</div>
	);
}

function ChatModeSelector(): ReactElement | null {
	const { setMode, mode, showSelector, setShowSelector, target } = useChatInput();
	const ref = useRef<HTMLSelectElement>(null);
	const hasTarget = target !== null;

	const onChange = useCallback((ev: React.ChangeEvent<HTMLSelectElement>) => {
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
			<option value=''>None</option>
			<option value='raw_chat'>Raw Chat</option>
			<option value='me' disabled={ hasTarget }>Me</option>
			<option value='raw_me' disabled={ hasTarget }>Raw Me</option>
			<option value='emote' disabled={ hasTarget }>Emote</option>
			<option value='raw_emote' disabled={ hasTarget }>Raw Emote</option>
			<option value='ooc'>OOC</option>
			<option value='raw_ooc'>Raw OOC</option>
		</Select>
	);
}
