import { clamp } from 'lodash-es';
import { AssertNever, GetLogger, type CharacterId, type ChatCharacterFullStatus, type ChatCharacterStatus, type CommandAutocompleteOption, type CommandAutocompleteResult, type Promisable } from 'pandora-common';
import { useCallback, useEffect, useRef, type ForwardedRef, type ReactElement, type RefObject } from 'react';
import { toast } from 'react-toastify';
import { useEvent } from '../../../common/useEvent.ts';
import { useTextFormattingOnKeyboardEvent } from '../../../common/useTextFormattingOnKeyboardEvent.ts';
import { ChatSendError, type IMessageParseOptions, type ISavedMessage } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatInput } from './chatInputContext.ts';
import type { AutocompleteDisplayData } from './commandsProcessor.ts';

export interface ChatInputHistoryDriver {
	get(index: number): string | undefined;
	insert(index: number, value: string): void;
	size(): number;
}

/** Handles restoration of input when user switches away from the chat momentarily */
export interface ChatInputRestoreDriver {
	get(): string;
	set(value: string): void;
}

export interface ChatInputMessageDriver {
	/** Send a chat message */
	sendMessage(message: string, options?: IMessageParseOptions): void;
	/** Delete a sent message (equivalent to send with empty message editing the message) */
	deleteMessage(deleteId: number): void;
	/** Get time in ms until message edit will time out, `undefined` if the message is not known or edit window already expired */
	getMessageEditTimeout(id: number): number | undefined;
	/** Get data about message to be edited, `undefined` if the message is not known or not editable */
	getMessageEdit(id: number): ISavedMessage | undefined;
	/** Get edit id of the last sent message */
	getLastMessageEdit(): number | undefined;
}

export function ChatInputTextArea({ messagesDiv, scrollMessagesView, inputHistory, inputRestore, messageSender, setPlayerStatus, placeholder, ref }: {
	messagesDiv: RefObject<HTMLDivElement | null>;
	scrollMessagesView: (forceScroll: boolean) => void;
	inputHistory: ChatInputHistoryDriver;
	inputRestore: ChatInputRestoreDriver;
	messageSender: ChatInputMessageDriver;
	setPlayerStatus: (status: ChatCharacterStatus, targets?: readonly CharacterId[]) => void;
	placeholder: string;
	ref: ForwardedRef<HTMLTextAreaElement>;
}): ReactElement {
	const actualRef = useTextFormattingOnKeyboardEvent(ref);

	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { targets, editing, setEditing, setValue, setAutocompleteHint, mode, commandsRunner } = useChatInput();
	const { chatCommandHintBehavior } = useAccountSettings();

	/**
	 * Index of currently selected "recently sent" message.
	 * -1 for when writing a new message.
	 * @see ChatInputHistoryDriver
	 */
	const inputHistoryIndex = useRef(-1);

	const inputEnd = useEvent(() => {
		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = null;
		}
		setPlayerStatus('none');
	});

	const selectAutocompleteOption = useEvent((option: CommandAutocompleteOption, commandKey: string) => {
		const textarea = actualRef.current;
		if (!textarea || textarea.disabled || textarea.readOnly || commandsRunner == null || !Object.hasOwn(commandsRunner, commandKey))
			return;

		const runner = commandsRunner[commandKey];
		const inputPosition = textarea.selectionStart || textarea.value.length;
		const input = option.replaceValue + ' ';

		const newValue = commandKey + input + textarea.value.slice(inputPosition).trimStart();

		textarea.value = newValue;
		textarea.focus();
		textarea.setSelectionRange(input.length + 1, input.length + 1, 'none');

		const autocompleteRequestResult = runner.autocomplete(input);

		function handleResult(result: CommandAutocompleteResult): void {
			// Bail out, if the value changed meanwhile
			if (textarea?.value !== newValue)
				return;

			const autocompleteResult: AutocompleteDisplayData = {
				replace: textarea.value,
				result,
				index: null,
				nextSegment: true,
			};

			if (chatCommandHintBehavior === 'always-show') {
				setAutocompleteHint({
					data: autocompleteResult,
					selectOption: selectAutocompleteOption,
					commandKey,
				});
			} else if (chatCommandHintBehavior === 'on-tab') {
				setAutocompleteHint(autocompleteResult.nextSegment ? null : {
					data: autocompleteResult,
					selectOption: selectAutocompleteOption,
					commandKey,
				});
			} else {
				AssertNever(chatCommandHintBehavior);
			}
		}

		if (autocompleteRequestResult != null && 'then' in autocompleteRequestResult) {
			setAutocompleteHint(null);
			autocompleteRequestResult.then((r) => {
				handleResult(r);
				updateTypingStatus(textarea);
			}, (error) => {
				updateTypingStatus(textarea);
				toast('Error processing autocomplete', TOAST_OPTIONS_ERROR);
				GetLogger('ChatInput').error('Error async processing autocomplete:', error);
			});
		} else {
			handleResult(autocompleteRequestResult);
		}
	});

	const updateCommandHelp = useEvent(async (textarea: HTMLTextAreaElement) => {
		let input = textarea.value;
		const originalInput = input;
		// Commands are not allowed in current context
		if (commandsRunner == null) {
			setAutocompleteHint(null);
			return;
		}

		// Check all prefixes
		for (const [key, runner] of Object.entries(commandsRunner)) {
			// Prefix does not match, or matcher is escaped
			if (!input.startsWith(key) || input.startsWith(key + key))
				continue;

			input = input.slice(key.length, textarea.selectionStart || textarea.value.length);

			const autocompleteResult = await runner.autocomplete(input);
			// If the input changed over await barrier, abort
			if (textarea.value !== originalInput)
				return;

			if (chatCommandHintBehavior === 'always-show') {
				// Set index to exactly matching entry, if there is one
				const matchingIndex = autocompleteResult?.options.findIndex((it) => it.replaceValue === input) ?? -1;
				setAutocompleteHint({
					data: {
						replace: textarea.value,
						result: autocompleteResult,
						index: matchingIndex >= 0 ? matchingIndex : null,
						nextSegment: false,
					},
					selectOption: selectAutocompleteOption,
					commandKey: key,
				});
			} else if (chatCommandHintBehavior === 'on-tab') {
				if (autocompleteResult != null &&
					autocompleteResult.options.length === 1 &&
					autocompleteResult.options[0].replaceValue === input &&
					!!autocompleteResult.options[0].longDescription
				) {
					// Display segments with long description anyway, if they match exactly
					setAutocompleteHint({
						data: {
							replace: textarea.value,
							result: autocompleteResult,
							index: 0,
							nextSegment: false,
						},
						selectOption: selectAutocompleteOption,
						commandKey: key,
					});
				} else {
					setAutocompleteHint(null);
				}
			} else {
				AssertNever(chatCommandHintBehavior);
			}

			return;
		}

		// No matched prefix
		setAutocompleteHint(null);
	});

	const handleSend = useCallback((input: string, forceOOC: boolean): Promisable<boolean> => {
		setAutocompleteHint(null);
		// Try to handle commands first
		if (commandsRunner != null) {
			for (const [key, runner] of Object.entries(commandsRunner)) {
				// Prefix must match
				if (!input.startsWith(key))
					continue;

				// Double command key escapes itself
				if (input.startsWith(key + key)) {
					input = input.slice(key.length);
					break;
				}

				// Process command
				return runner.run(input.slice(key.length));
			}
		}

		input = input.trim();
		const type = mode?.type || (forceOOC ? 'ooc' : undefined);
		const raw = mode?.raw || undefined;
		if (type === 'ooc' && !raw && input.startsWith('((')) {
			input = input.slice(2).trim();
		}
		// Ignore empty input, unless editing
		if (editing == null && !input) {
			return false;
		}
		// TODO ... all options
		messageSender.sendMessage(input, {
			targets: targets?.map((t) => t.id),
			editing: editing?.target || undefined,
			type,
			raw,
		});
		return true;
	}, [commandsRunner, editing, mode, messageSender, setAutocompleteHint, targets]);

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		const input = textarea.value;
		if (textarea.disabled || textarea.readOnly)
			return;

		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				function cleanup() {
					textarea.value = '';
					inputHistoryIndex.current = -1;
					setEditing(null);

					if (input && (inputHistory.size() === 0 || inputHistory.get(0) !== input)) {
						inputHistory.insert(0, input);
					}
				}

				const result = handleSend(input, ev.altKey);
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
						updateTypingStatus(textarea);
					}, (error) => {
						textarea.disabled = false;
						updateTypingStatus(textarea);
						toast('Error processing command', TOAST_OPTIONS_ERROR);
						GetLogger('ChatInput').error('Error async processing input:', error);
					});
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
		} else if (ev.key === 'Tab' && commandsRunner != null) {
			try {
				for (const [key, runner] of Object.entries(commandsRunner)) {
					// Prefix must match
					if (!input.startsWith(key))
						continue;

					// Double command key escapes itself
					if (input.startsWith(key + key))
						break;

					ev.preventDefault();
					ev.stopPropagation();

					// Process command
					const inputPosition = textarea.selectionStart || textarea.value.length;
					const originalInput = textarea.value;
					const command = originalInput.slice(key.length, inputPosition);

					const autocompleteRequestResult = runner.autocompleteCycle(command, ev.shiftKey);

					function handleResult(result: AutocompleteDisplayData): void {
						// Bail out, if the value changed meanwhile
						if (textarea.value !== originalInput)
							return;

						const replacementStart = key + result.replace;

						textarea.value = replacementStart + textarea.value.slice(inputPosition).trimStart();
						textarea.setSelectionRange(replacementStart.length, replacementStart.length, 'none');
						if (chatCommandHintBehavior === 'always-show') {
							setAutocompleteHint({
								data: result,
								selectOption: selectAutocompleteOption,
								commandKey: key,
							});
						} else if (chatCommandHintBehavior === 'on-tab') {
							setAutocompleteHint(result.nextSegment ? null : {
								data: result,
								selectOption: selectAutocompleteOption,
								commandKey: key,
							});
						} else {
							AssertNever(chatCommandHintBehavior);
						}
					}

					if ('then' in autocompleteRequestResult) {
						setAutocompleteHint(null);
						autocompleteRequestResult.then((r) => {
							handleResult(r);
							updateTypingStatus(textarea);
						}, (error) => {
							updateTypingStatus(textarea);
							toast('Error processing autocomplete', TOAST_OPTIONS_ERROR);
							GetLogger('ChatInput').error('Error async processing autocomplete:', error);
						});
					} else {
						handleResult(autocompleteRequestResult);
					}

					break;
				}
			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
					GetLogger('ChatInput').error('Error processing tab completion:', error);
				}
			}
		} else if (ev.key === 'ArrowUp' && !textarea.value.trim()) {
			ev.preventDefault();
			ev.stopPropagation();
			const edit = messageSender.getLastMessageEdit();
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

			if (inputHistoryIndex.current + 1 < inputHistory.size()) {
				// Save the current input, if it has been modified
				if (input && inputHistoryIndex.current < 0) {
					inputHistory.insert(0, input);
					inputHistoryIndex.current = 0;
				} else if (input && inputHistory.get(inputHistoryIndex.current) !== input) {
					inputHistory.insert(inputHistoryIndex.current, input);
				}

				// Replace current value with one from history
				inputHistoryIndex.current++;
				textarea.value = inputHistory.get(inputHistoryIndex.current) ?? '';
			}
		} else if (ev.key === 'PageDown' && !ev.shiftKey) {
			// On page down without shift, we show the next sent message (after going to previous)
			ev.preventDefault();
			ev.stopPropagation();

			if (inputHistoryIndex.current >= 0) {
				// Save the current input, if it has been modified
				if (input !== '' && inputHistory.get(inputHistoryIndex.current) !== input) {
					inputHistory.insert(inputHistoryIndex.current, input);
				}

				// Replace current value with one from history
				inputHistoryIndex.current--;
				textarea.value = inputHistoryIndex.current < 0 ? '' : (inputHistory.get(inputHistoryIndex.current) ?? '');
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
		inputRestore.set(value);

		let nextStatus: ChatCharacterFullStatus | undefined;
		const trimmed = value.trim();
		// Only start showing typing indicator once user wrote at least three characters. Commands handle it themselves
		if (commandsRunner != null) {
			for (const [key, runner] of Object.entries(commandsRunner)) {
				// Prefix must match
				if (!value.startsWith(key))
					continue;

				// Double command key escapes itself
				if (value.startsWith(key + key))
					break;

				nextStatus = runner.getChatStatus(value.slice(key.length));
			}
		}

		if (nextStatus == null) {
			// Was not handled by commands
			if (trimmed.length >= 3) {
				nextStatus = { status: targets ? 'whispering' : 'typing', targets: targets?.map((t) => t.id) };
			} else {
				nextStatus = { status: 'none' };
			}
		}

		if (nextStatus.status === 'none') {
			inputEnd();
			return;
		}

		setPlayerStatus(nextStatus.status, nextStatus.targets);

		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = null;
		}
		timeout.current = setTimeout(() => inputEnd(), 3_000);
	};

	const onChange = useEvent((ev: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = ev.target;
		if (textarea.disabled || textarea.readOnly)
			return;
		updateCommandHelp(textarea)
			.catch((err) => {
				toast('Error updating command help', TOAST_OPTIONS_ERROR);
				GetLogger('ChatInput').error('Error updating command help:', err);
			});
		updateTypingStatus(textarea);
	});

	useEffect(() => () => inputEnd(), [inputEnd]);

	return (
		<textarea
			placeholder={ placeholder }
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			onChange={ onChange }
			onBlur={ inputEnd }
			defaultValue={ inputRestore.get() }
		/>
	);
}
