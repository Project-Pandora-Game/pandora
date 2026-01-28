import { Immutable } from 'immer';
import { clamp } from 'lodash-es';
import { AssertNever, GetLogger, LIMIT_DIRECT_MESSAGE_LENGTH, ZodTransformReadonly, type Promisable } from 'pandora-common';
import React, { ReactElement, useCallback, useRef, type RefObject } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import { BrowserStorage } from '../../browserStorage.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useTextFormattingOnKeyboardEvent } from '../../common/useTextFormattingOnKeyboardEvent.ts';
import { useInputAutofocus } from '../../common/userInteraction/inputAutofocus.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { useChatInput } from '../../ui/components/chat/chatInputContext.tsx';
import { COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, RunCommand } from '../../ui/components/chat/commandsProcessor.ts';
import { useDirectMessageCommandContext } from './directMessageCommandContext.tsx';
import { DIRECT_MESSAGE_COMMANDS } from './directMessageCommands.tsx';

const DirectMessageInputSaveSchema = z.object({
	input: z.string(),
	history: z.string().array().transform(ZodTransformReadonly),
});
type DirectMessageInputSave = z.infer<typeof DirectMessageInputSaveSchema>;

export const DirectMessageInputSaveStorage = BrowserStorage.createSession<Immutable<Partial<Record<string, DirectMessageInputSave>>>>('directMessage.inputSave', {}, z.partialRecord(z.string(), DirectMessageInputSaveSchema.optional()));
/** How many last sent messages are remembered in the session storage _per chat_ */
const INPUT_HISTORY_MAX_LENGTH = 16;

export function DirectMessageInput({ chatId, messagesDiv, scrollMessagesView, ref }: {
	/** Arbitrary chat id to tell chats apart. Right now simply account id, but could be expanded in the future. */
	chatId: string;
	messagesDiv: RefObject<HTMLDivElement | null>;
	scrollMessagesView: (forceScroll: boolean) => void;
	ref: React.ForwardedRef<HTMLTextAreaElement>;
}): ReactElement | null {
	const commandInvokeContext = useDirectMessageCommandContext(true);
	const chat = commandInvokeContext.chat;
	const info = useObservable(chat.displayInfo);
	const { editing, setEditing, setAutocompleteHint, allowCommands, setValue } = useChatInput();
	const { chatCommandHintBehavior } = useAccountSettings();

	/**
	 * Index of currently selected "recently sent" message.
	 * -1 for when writing a new message.
	 * @see InputHistory
	 */
	const inputHistoryIndex = useRef(-1);

	const updateCommandHelp = useEvent((textarea: HTMLTextAreaElement) => {
		let input = textarea.value;
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			input = input.slice(1, textarea.selectionStart || textarea.value.length);

			const autocompleteResult = CommandAutocomplete(input, commandInvokeContext, DIRECT_MESSAGE_COMMANDS);

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

	const handleSend = useCallback((input: string): Promisable<boolean> => {
		setAutocompleteHint(null);
		if (
			input.startsWith(COMMAND_KEY) &&
			!input.startsWith(COMMAND_KEY + COMMAND_KEY) &&
			allowCommands
		) {
			// Process command
			return RunCommand(input.slice(1), commandInvokeContext, DIRECT_MESSAGE_COMMANDS);
		} else {
			if (input.startsWith(COMMAND_KEY + COMMAND_KEY) && allowCommands) {
				input = input.slice(1);
			}
			input = input.trim();
			// Ignore empty input, unless editing
			if (editing == null && !input) {
				return false;
			}
			commandInvokeContext.sendMessage(input, editing?.target)
				.catch((e) => {
					toast(`Failed to send message: ${String(e)}`, TOAST_OPTIONS_ERROR);
					GetLogger('DirectMessage').error('Failed to send message:', e);
				});

			return true;
		}
	}, [allowCommands, commandInvokeContext, editing, setAutocompleteHint]);

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

					if (input) {
						const inputSave = DirectMessageInputSaveStorage.value;
						const inputSaveData = Object.hasOwn(inputSave, chatId) ? inputSave[chatId] : undefined;
						if (inputSaveData == null || inputSaveData.history.length === 0 || inputSaveData.history[0] !== input) {
							DirectMessageInputSaveStorage.produceImmer((d) => {
								const dSaveData = (d[chatId] ??= { input: '', history: [] });
								dSaveData.history.unshift(input);
								if (dSaveData.history.length > INPUT_HISTORY_MAX_LENGTH) {
									dSaveData.history.splice(INPUT_HISTORY_MAX_LENGTH, dSaveData.history.length - INPUT_HISTORY_MAX_LENGTH);
								}
							});
						}
					}
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
						updateTypingStatus(textarea);
					}, (error) => {
						textarea.disabled = false;
						updateTypingStatus(textarea);
						toast('Error processing command', TOAST_OPTIONS_ERROR);
						GetLogger('DirectChannelInput').error('Error async processing input:', error);
					});
				}
			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
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

				const autocompleteResult = CommandAutocompleteCycle(command, commandInvokeContext, DIRECT_MESSAGE_COMMANDS, ev.shiftKey);

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
			// TODO: Support editing
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

			const inputSave = DirectMessageInputSaveStorage.value;
			const inputSaveData = Object.hasOwn(inputSave, chatId) ? inputSave[chatId] : undefined;
			if (inputSaveData != null && inputHistoryIndex.current + 1 < inputSaveData.history.length) {
				const nextValue = inputSaveData.history[inputHistoryIndex.current + 1];

				// Save the current input, if it has been modified
				if (input && inputHistoryIndex.current < 0) {
					DirectMessageInputSaveStorage.produceImmer((d) => {
						const dSaveData = (d[chatId] ??= { input: '', history: [] });
						dSaveData.history.unshift(input);
					});
					inputHistoryIndex.current = 0;
				} else if (input && inputSaveData.history[inputHistoryIndex.current] !== input) {
					DirectMessageInputSaveStorage.produceImmer((d) => {
						const dSaveData = (d[chatId] ??= { input: '', history: [] });
						dSaveData.history.splice(inputHistoryIndex.current, 0, input);
					});
				}

				// Replace current value with one from history
				inputHistoryIndex.current++;
				textarea.value = nextValue;
			}
		} else if (ev.key === 'PageDown' && !ev.shiftKey) {
			// On page down without shift, we show the next sent message (after going to previous)
			ev.preventDefault();
			ev.stopPropagation();

			const inputSave = DirectMessageInputSaveStorage.value;
			const inputSaveData = Object.hasOwn(inputSave, chatId) ? inputSave[chatId] : undefined;
			if (inputSaveData != null && inputHistoryIndex.current >= 0 && inputHistoryIndex.current < inputSaveData.history.length) {
				// Save the current input, if it has been modified
				if (input !== '' && inputSaveData.history[inputHistoryIndex.current] !== input) {
					DirectMessageInputSaveStorage.produceImmer((d) => {
						const dSaveData = (d[chatId] ??= { input: '', history: [] });
						dSaveData.history.splice(inputHistoryIndex.current, 0, input);
					});
				}

				// Replace current value with one from history
				inputHistoryIndex.current--;
				textarea.value = inputHistoryIndex.current < 0 ? '' : inputSaveData.history[inputHistoryIndex.current];
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

	const updateTypingStatus = useCallback((textarea: HTMLTextAreaElement) => {
		const value = textarea.value;
		DirectMessageInputSaveStorage.produceImmer((d) => {
			const dSaveData = (d[chatId] ??= { input: '', history: [] });
			dSaveData.input = value;
		});
		// Direct messages do not support typing status (yet)
	}, [chatId]);

	const onChange = useEvent((ev: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		if (textarea.disabled || textarea.readOnly)
			return;
		updateCommandHelp(textarea);
		updateTypingStatus(textarea);
	});

	const actualRef = useTextFormattingOnKeyboardEvent(ref);
	useInputAutofocus(actualRef);

	const inputRestore = DirectMessageInputSaveStorage.value;
	const inputRestoreData = Object.hasOwn(inputRestore, chatId) ? inputRestore[chatId] : undefined;

	return (
		<textarea
			placeholder={ `> Send message to ${info.displayName ?? '[Loading ...]'} (${chat.id}) or use a /command` }
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			onChange={ onChange }
			maxLength={ LIMIT_DIRECT_MESSAGE_LENGTH }
			defaultValue={ inputRestoreData?.input ?? '' }
		/>
	);
}
