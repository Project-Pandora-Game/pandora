import type { CharacterId, IChatRoomStatus, RoomId } from 'pandora-common';
import React, { createContext, ForwardedRef, forwardRef, ReactElement, RefObject, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { noop } from 'lodash';
import { Character } from '../../character/character';
import { useChatRoomCharacters, useChatRoomData, useChatRoomMessageSender, useChatRoomSetPlayerStatus, useChatRoomStatus } from '../gameContext/chatRoomContextProvider';
import { useEvent } from '../../common/useEvent';
import { COMMAND_KEY } from './commands';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { Button } from '../common/Button/Button';
import { usePlayerId } from '../gameContext/playerContextProvider';
import './chatroom.scss';
import { BrowserStorage } from '../../browserStorage';

export type IChatInputHandler = {
	focus: () => void;
	setValue: (value: string) => void;
	target: Character | null;
	setTarget: (target: CharacterId | null) => void;
	editing: number | null;
	setEditing: (editing: number | null) => boolean;
	ref: RefObject<HTMLTextAreaElement>;
};

const chatInputContext = createContext<IChatInputHandler>({
	focus: noop,
	setValue: noop,
	target: null,
	setTarget: noop,
	editing: null,
	setEditing: () => false,
	ref: null as unknown as RefObject<HTMLTextAreaElement>,
});

type ChatInputSave = {
	input: string;
	roomId: RoomId | null;
};
const InputResore = BrowserStorage.createSession<ChatInputSave>('saveChatInput', { input: '', roomId: null });

export function ChatInputContextProvider({ children }: { children: React.ReactNode }) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [target, setTarget] = useState<Character | null>(null);
	const [editing, setEditingState] = useState<number | null>(null);
	const characters = useChatRoomCharacters();
	const sender = useChatRoomMessageSender();
	const playerId = usePlayerId();
	const roomId = useChatRoomData()?.id;

	useEffect(() => {
		if (!roomId)
			return;

		if (roomId !== InputResore.value.roomId) {
			InputResore.value = { input: '', roomId };
		}
	}, [roomId]);

	const setEditing = useEvent((messageId: number | null) => {
		setEditingState(messageId);
		if (!messageId) {
			ref.current?.focus();
			return true;
		}
		const { text, target: targetId } = sender.getMessageEdit(messageId) ?? {};
		if (!text) {
			return false;
		}
		if (targetId) {
			const targetCharacter = characters?.find((c) => c.data.id === targetId);
			if (targetCharacter) {
				setTarget(targetCharacter);
			} else {
				toast(`Character ${targetId} not found`, TOAST_OPTIONS_ERROR);
			}
		}
		if (ref.current) {
			ref.current.value = text;
			ref.current.focus();
		}
		return true;
	});

	const context = useMemo(() => ({
		focus: () => ref.current?.focus(),
		setValue: (value: string) => {
			if (ref.current) {
				ref.current.value = value;
			}
			InputResore.value = { input: value, roomId: InputResore.value.roomId };
		},
		target,
		setTarget: (t: CharacterId | null) => {
			if (t === playerId) {
				return;
			}
			setTarget(!t ? null : characters?.find((c) => c.data.id === t) ?? null);
		},
		editing,
		setEditing,
		ref,
	}), [target, editing, setEditing, playerId, characters]);

	return (
		<chatInputContext.Provider value={ context }>
			{ children }
		</chatInputContext.Provider>
	);
}

export function ChatInputArea({ messagesDiv, scroll }: { messagesDiv: RefObject<HTMLDivElement>; scroll: () => void }) {
	const { ref } = useChatInput();
	return (
		<>
			<TypingIndicator scroll={ scroll } />
			<Modifiers scroll={ scroll } />
			<TextArea ref={ ref } messagesDiv={ messagesDiv } />
		</>
	);
}

function TextAreaImpl({ messagesDiv }: { messagesDiv: RefObject<HTMLDivElement> }, ref: ForwardedRef<HTMLTextAreaElement>) {
	const currentTarget = useRef<CharacterId | undefined>();
	const lastStatus = useRef<IChatRoomStatus>('none');
	const lastInput = useRef('');
	const timeout = useRef<number>();
	const setPlayerStatus = useChatRoomSetPlayerStatus();
	const sender = useChatRoomMessageSender();
	const { target, editing, setEditing, setValue } = useChatInput();

	const sendStatus = useEvent((status: IChatRoomStatus) => {
		setPlayerStatus(status, currentTarget.current);
		lastStatus.current = status;
	});

	const inputEnd = useEvent(() => {
		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = 0;
		}
		if (lastStatus.current === 'none') {
			return;
		}
		sendStatus('none');
	});

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			ev.stopPropagation();
			try {
				// TODO ... all options
				sender.sendMessage(textarea.value, {
					target: target?.data.id,
					editing: editing || undefined,
				});
				textarea.value = '';
				setEditing(null);
			} catch (error) {
				if (error instanceof Error) {
					toast(error.message, TOAST_OPTIONS_ERROR);
				}
				return;
			}
		}
		if (ev.key === 'ArrowUp' && !textarea.value.trim()) {
			ev.preventDefault();
			ev.stopPropagation();
			const edit =  sender.getLastMessageEdit();
			if (edit) {
				setEditing(edit);
				return;
			}
		}
		if ((ev.key === 'PageUp' || ev.key === 'PageDown') && !ev.shiftKey) {
			messagesDiv.current?.focus();
			return;
		}
		if (ev.key === 'Escape' && editing) {
			ev.preventDefault();
			ev.stopPropagation();
			setEditing(null);
			setValue('');
			return;
		}

		const value = textarea.value;
		if (value === lastInput.current)
			return;

		lastInput.current = value;
		InputResore.value = { input: value, roomId: InputResore.value.roomId };
		let nextStatus: null | { status: IChatRoomStatus, target?: CharacterId } = null;
		const trimmed = value.trim();
		if (trimmed.length > 0 && !trimmed.startsWith(COMMAND_KEY)) {
			nextStatus = { status: target ? 'whisper' : 'typing', target: target?.data.id };
		} else {
			nextStatus = { status: 'none' };
		}

		if (nextStatus.status === 'none') {
			inputEnd();
			return;
		}

		const lastTarget = currentTarget.current;
		currentTarget.current = nextStatus.target;

		if (nextStatus.status !== lastStatus.current || nextStatus.target !== lastTarget) {
			sendStatus(nextStatus.status);
		}

		if (timeout.current) {
			clearTimeout(timeout.current);
			timeout.current = 0;
		}
		timeout.current = setTimeout(() => inputEnd(), 3_000);
	});

	useEffect(() => () => inputEnd(), [inputEnd]);

	return <textarea ref={ ref } onKeyDown={ onKeyDown } onBlur={ inputEnd } defaultValue={ InputResore.value.input } />;
}

const TextArea = forwardRef(TextAreaImpl);

export function useChatInput(): IChatInputHandler {
	return useContext(chatInputContext);
}

function TypingIndicator({ scroll }: { scroll: () => void }): ReactElement {
	const statuses = useChatRoomStatus();
	const lastStatusLength = useRef(0);

	useEffect(() => {
		if (lastStatusLength.current !== statuses.length) {
			scroll();
			lastStatusLength.current = statuses.length;
		}
	}, [statuses, scroll]);

	return (
		<div className='typing-indicator'>
			{ statuses.map(({ data, status }) => (
				<span key={ data.id }>
					<span style={ { color: data.settings.labelColor } }>{ data.name } </span>
					({ data.id })
					{ ' ' }
					{ status }
				</span>
			)) }
		</div>
	);
}

function Modifiers({ scroll }: { scroll: () => void }): ReactElement {
	const { target, setTarget, editing, setEditing, setValue } = useChatInput();
	const lastHasTarget = useRef(target !== null);
	const lastEditing = useRef(editing);

	useEffect(() => {
		if (lastHasTarget.current !== (target !== null) || lastEditing.current !== editing) {
			scroll();
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
					<Button className='slim' onClick={ () => setTarget(null) }>Cancel</Button>
				</span>
			) }
			{ editing && (
				<span>
					{ 'Editing message ' }
					<Button className='slim' onClick={ () => {
						setEditing(null);
						setValue('');
					} }>
						Cancel
					</Button>
				</span>
			) }
		</div>
	);
}
