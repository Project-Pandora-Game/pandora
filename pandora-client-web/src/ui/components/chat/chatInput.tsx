import { Assert, CHARACTER_SETTINGS_DEFAULT, CharacterId, CompareCharacterIds, EMPTY_ARRAY, IChatType, IsNotNullable, SpaceIdSchema, ZodTransformReadonly, type ChatCharacterStatus, type ICharacterRoomData } from 'pandora-common';
import React, { ForwardedRef, ReactElement, RefObject, useCallback, useEffect, useId, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import focusIcon from '../../../assets/icons/focus.svg';
import settingsIcon from '../../../assets/icons/setting.svg';
import statusTypingIcon from '../../../assets/icons/status-typing.svg';
import statusWhisperingIcon from '../../../assets/icons/status-whispering.svg';
import { BrowserStorage } from '../../../browserStorage.ts';
import { Character } from '../../../character/character.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { useCharacterSettings, usePlayerId, usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider.tsx';
import { useNullableObservable, useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatCharacterStatus, useChatMessageSender, useChatSetPlayerStatus } from '../../../services/gameLogic/chatHooks.ts';
import { useGameStateOptional, useSpaceCharacters } from '../../../services/gameLogic/gameStateHooks.ts';
import { useService } from '../../../services/serviceProvider.tsx';
import { ColoredName } from '../common/coloredName.tsx';
import { ChatActionLog, ChatFocusMode, ChatInputContext, useChatActionLogDisabled, useChatFocusModeForced, useChatInput, type ChatInputAutocompleteState, type ChatInputCommandRunner, type ChatInputHandlerEditing, type ChatMode, type IChatInputHandler } from './chatInputContext.ts';
import { ChatInputTextArea, type ChatInputHistoryDriver, type ChatInputRestoreDriver } from './chatInputTextArea.tsx';
import { COMMANDS, GetChatModeDescription } from './commands.ts';
import { COMMAND_KEY, CommandAutocomplete, CommandAutocompleteCycle, CommandGetChatStatus, ICommandExecutionContextClient, ICommandInvokeContext, RunCommand } from './commandsProcessor.ts';

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

export function ChatInputContextProvider({ children }: { children: React.ReactNode; }) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [targets, setTargets] = useState<readonly Character[] | null>(null);
	const [editing, setEditingState] = useState<ChatInputHandlerEditing | null>(null);
	const [autocompleteHint, setAutocompleteHint] = useState<ChatInputAutocompleteState | null>(null);
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

	const setEditing = useEvent((edit: ChatInputHandlerEditing | null) => {
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
		if (options.targets) {
			const targetCharacters: Character<ICharacterRoomData>[] = [];
			for (const id of options.targets) {
				const character = characters?.find((c) => c.data.id === id);
				if (character == null) {
					toast(`Character ${id} not found`, TOAST_OPTIONS_ERROR);
					return false;
				}
				if (!targetCharacters.includes(character)) {
					targetCharacters.push(character);
				}
			}
			setTargets(targetCharacters.length > 0 ? targetCharacters : null);
		} else {
			setTargets(null);
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

	const newSetTargets = useCallback((newTargets: readonly CharacterId[] | null) => {
		const targetCharacters: Character<ICharacterRoomData>[] | undefined = newTargets?.map((t) => t === playerId ? undefined : characters?.find((c) => c.data.id === t)).filter(IsNotNullable);
		setTargets(targetCharacters != null && targetCharacters.length > 0 ? targetCharacters.toSorted((a, b) => a.name.localeCompare(b.name) || CompareCharacterIds(a.id, b.id)) : null);
	}, [characters, playerId]);

	const commandInvokeContextGenerator = useChatCommandContextGenerator(mode, setMode, newSetTargets);

	const clientCommandRunner = useMemo((): ChatInputCommandRunner => ({
		run(input) {
			const ctx = commandInvokeContextGenerator();
			Assert(ctx != null, 'Command run called whiled not ready');

			return RunCommand(input, ctx, COMMANDS);
		},
		autocomplete(input) {
			const ctx = commandInvokeContextGenerator();
			Assert(ctx != null, 'Command autocomplete called whiled not ready');

			return CommandAutocomplete(input, ctx, COMMANDS);
		},
		autocompleteCycle(input, reverse) {
			const ctx = commandInvokeContextGenerator();
			Assert(ctx != null, 'Command autocompleteCycle called whiled not ready');

			return CommandAutocompleteCycle(input, ctx, COMMANDS, reverse);
		},
		getChatStatus(input) {
			const ctx = commandInvokeContextGenerator();
			Assert(ctx != null, 'Command getChatStatus called whiled not ready');

			return CommandGetChatStatus(input, ctx, COMMANDS);
		},
	}), [commandInvokeContextGenerator]);

	const commandsRunner = useMemo(() => ({
		[COMMAND_KEY]: clientCommandRunner,
	}), [clientCommandRunner]);

	// Handler to autofocus chat input
	useInputAutofocus(ref);

	const context = useMemo((): IChatInputHandler => {
		return {
			setValue: (value: string) => {
				if (ref.current) {
					ref.current.value = value;
				}
				InputRestore.value = { input: value, spaceId: InputRestore.value.spaceId };
			},
			targets,
			setTargets: newSetTargets,
			editing,
			setEditing: (edit: number | null): boolean => {
				if (edit === null) {
					if (editing === null)
						return setEditing(null);

					newSetTargets(editing?.restore.targets ?? null);
					setMode(editing?.restore.type ? { type: editing.restore.type, raw: editing.restore.raw ?? false } : null);
					return setEditing(null);
				} else if (editing)
					return setEditing({ target: edit, restore: editing.restore });
				else
					return setEditing({ target: edit, restore: { targets: targets?.map((t) => t.id), type: mode?.type, raw: mode?.raw } });
			},
			autocompleteHint,
			setAutocompleteHint,
			mode,
			setMode,
			showSelector,
			setShowSelector,
			commandsRunner: editing == null && !mode?.raw ? commandsRunner : null,
			ref,
		};
	}, [targets, newSetTargets, editing, setEditing, autocompleteHint, commandsRunner, showSelector, setShowSelector, mode]);

	return (
		<ChatInputContext.Provider value={ context }>
			{ children }
		</ChatInputContext.Provider>
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
			<ActionLogActiveNotifier />
			<TypingIndicator />
			<Modifiers scroll={ scroll } />
			<ChatModeSelector />
			<TextArea ref={ ref } messagesDiv={ messagesDiv } scrollMessagesView={ scroll } />
		</>
	);
}

function TextArea({ messagesDiv, scrollMessagesView, ref }: {
	messagesDiv: RefObject<HTMLDivElement | null>;
	scrollMessagesView: (forceScroll: boolean) => void;
	ref: ForwardedRef<HTMLTextAreaElement>;
}) {
	const inputHistory = useMemo((): ChatInputHistoryDriver => ({
		get(index) {
			return InputHistory.value[index];
		},
		insert(index, value) {
			InputHistory.produceImmer((arr) => {
				arr.splice(index, 0, value);
				if (arr.length > INPUT_HISTORY_MAX_LENGTH) {
					arr.splice(INPUT_HISTORY_MAX_LENGTH, arr.length - INPUT_HISTORY_MAX_LENGTH);
				}
			});
		},
		size() {
			return InputHistory.value.length;
		},
	}), []);

	const inputRestore = useMemo((): ChatInputRestoreDriver => ({
		get() {
			return InputRestore.value.input;
		},
		set(value) {
			InputRestore.value = { input: value, spaceId: InputRestore.value.spaceId };
		},
	}), []);

	const sender = useChatMessageSender();
	const setPlayerStatus = useChatSetPlayerStatus();

	return (
		<ChatInputTextArea
			messagesDiv={ messagesDiv }
			scrollMessagesView={ scrollMessagesView }
			inputHistory={ inputHistory }
			inputRestore={ inputRestore }
			messageSender={ sender }
			setPlayerStatus={ setPlayerStatus }
			placeholder='> Type message or /command'
			ref={ ref }
		/>
	);
}

function TypingIndicator(): ReactElement {
	const statuses = useChatCharacterStatus();
	const { player, globalState, playerState } = usePlayerState();
	const playerId = player.id;
	const { showSelector, setShowSelector } = useChatInput();

	const onClick = useCallback((ev: React.MouseEvent<HTMLDivElement>) => {
		ev.stopPropagation();
		setShowSelector(!showSelector);
	}, [showSelector, setShowSelector]);

	const focusModeSetting = useObservable(ChatFocusMode);
	const focusModeForced = useChatFocusModeForced();
	const focusMode = focusModeForced ?? focusModeSetting;

	const statusGroups: Partial<Record<ChatCharacterStatus, ICharacterRoomData[]>> = {};

	for (const s of statuses) {
		// Skip player
		if (s.data.id === playerId)
			continue;

		// Hide typing state of characters in other rooms, except whispering
		if (focusMode && s.status !== 'whispering') {
			const characterState = globalState.getCharacterState(s.data.id);
			if (characterState != null && characterState.currentRoom !== playerState.currentRoom)
				continue;
		}

		(statusGroups[s.status] ??= []).push(s.data);
	}

	return (
		<div className='typing-indicator' onClick={ onClick }>
			{ focusMode ? (
				<img
					src={ focusIcon }
					alt='Focus mode'
					title='Focus mode - messages from other rooms are hidden'
				/>
			) : null }
			<Row className='flex-1' wrap>
				{ statusGroups.whispering != null && statusGroups.whispering.length > 4 ? (
					<span>Multiple people are whispering</span>
				) : statusGroups.whispering != null && statusGroups.whispering.length > 0 ? (
					statusGroups.whispering.map((character) => (
						<Row
							key={ character.id }
							alignY='center'
							gap='small'
							title={ `${character.name} (${character.id}) is whispering` }
						>
							<ColoredName color={ character.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor }>
								{ character.name }
							</ColoredName>
							<img src={ statusWhisperingIcon } alt='is typing' />
						</Row>
					))
				) : null }
				{ statusGroups.typing != null && statusGroups.typing.length > 4 ? (
					<span>Multiple people are typing</span>
				) : statusGroups.typing != null && statusGroups.typing.length > 0 ? (
						statusGroups.typing.map((character) => (
							<Row
								key={ character.id }
								alignY='center'
								gap='small'
								title={ `${character.name} (${character.id}) is typing` }
							>
								<ColoredName color={ character.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor }>
									{ character.name }
								</ColoredName>
								<img src={ statusTypingIcon } alt='is typing' />
							</Row>
						))
				) : null }
			</Row>
			<img src={ settingsIcon } alt='Change chat mode' />
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
	const { targets, setTargets, editing, setEditing, setValue, mode, setMode } = useChatInput();
	const lastHasTarget = useRef(targets !== null);
	const lastEditing = useRef(editing);

	useEffect(() => {
		if (lastHasTarget.current !== (targets !== null) || lastEditing.current !== editing) {
			scroll(false);
			lastHasTarget.current = targets !== null;
			lastEditing.current = editing;
		}
	}, [targets, editing, scroll]);

	return (
		<div className='input-modifiers'>
			{ targets != null ? (
				<span>
					{ 'Whispering to ' }
					{ targets.map((t, i) => (
						<React.Fragment key={ i }>
							{ i !== 0 ? ', ' : null }
							<ColoredName color={ t.data.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor }>{ t.data.name }</ColoredName>
							{ ' ' }
							({ t.data.id })
						</React.Fragment>
					)) }
					{ ' ' }
					{ editing === null && (
						<Button className='slim' onClick={ (ev) => {
							ev.stopPropagation();
							setTargets(null);
						} }>Cancel
						</Button>
					) }
				</span>
			) : null }
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

function ActionLogActiveNotifier(): ReactElement | null {
	const actionLog = useObservable(ChatActionLog);
	const actionLogDisabled = useChatActionLogDisabled();

	if (!actionLog || actionLogDisabled)
		return null;

	return (
		<div className='input-modifiers'>
			<span>
				<span>{ 'Showing action log ' }</span>
				<Button className='slim' onClick={ (ev) => {
					ev.stopPropagation();
					ChatActionLog.value = false;
				} }>
					Hide
				</Button>
			</span>
		</div>
	);
}

export function useChatCommandContextGenerator(
	chatMode: ChatMode | null,
	setChatMode: (mode: ChatMode | null) => void,
	setChatTargets: (targets: readonly CharacterId[] | null) => void,
): () => (ICommandInvokeContext<ICommandExecutionContextClient> | null) {
	const navigate = useNavigatePandora();

	const gameState = useGameStateOptional();
	const shardConnector = useShardConnector();
	const directoryConnector = useDirectoryConnector();
	const accountManager = useService('accountManager');

	const accountSettings = useAccountSettings();
	const characterSettings = useCharacterSettings();

	return useCallback((): ICommandInvokeContext<ICommandExecutionContextClient> | null => {
		if (gameState == null || shardConnector == null)
			return null;

		const globalState = gameState.globalState.currentState;

		return {
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
			messageSender: gameState,
			getChatMode: () => chatMode,
			setChatMode,
			setChatTargets,
			navigate,
		};
	}, [accountManager, accountSettings, characterSettings, directoryConnector, gameState, navigate, chatMode, setChatMode, setChatTargets, shardConnector]);
}

function ChatModeSelector(): ReactElement | null {
	const id = useId();
	const { setMode, mode, showSelector, setShowSelector, targets } = useChatInput();
	const focusModeSetting = useObservable(ChatFocusMode);
	const actionLogSetting = useObservable(ChatActionLog);
	const actionLogDisabled = useChatActionLogDisabled();
	const focusModeForced = useChatFocusModeForced();
	const focusMode = focusModeForced ?? focusModeSetting;
	const ref = useRef<HTMLSelectElement>(null);
	const hasTarget = targets !== null;

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

	const stopPropagation = useCallback((ev: SyntheticEvent) => {
		ev.stopPropagation();
	}, []);

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
		<>
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
			<div className='input-modifiers padding-small' onClick={ stopPropagation }>
				<Checkbox
					checked={ focusMode }
					onChange={ (newValue) => {
						ChatFocusMode.value = newValue;
					} }
					disabled={ focusModeForced != null }
					id={ `${id}:focus-mode-toggle` }
				/>
				<img src={ focusIcon } alt='Focus mode' />
				<label htmlFor={ `${id}:focus-mode-toggle` }>
					Enable focus mode - hide messages from other rooms
				</label>
				{ focusModeForced != null ? (
					<span>(controlled by a character modifier)</span>
				) : null }
			</div>
			<div className='input-modifiers padding-small' onClick={ stopPropagation }>
				<Checkbox
					checked={ actionLogSetting && !actionLogDisabled }
					onChange={ (newValue) => {
						ChatActionLog.value = newValue;
					} }
					disabled={ actionLogDisabled }
					id={ `${id}:action-log-toggle` }
				/>
				<label htmlFor={ `${id}:action-log-toggle` }>
					Show action log
				</label>
				{ actionLogDisabled ? (
					<span>(controlled by a character modifier)</span>
				) : null }
			</div>
		</>
	);
}
