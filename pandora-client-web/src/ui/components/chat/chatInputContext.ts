import { AssertNotNullable, type CharacterId, type CharacterRestrictionsManager, type IChatType } from 'pandora-common';
import { createContext, RefObject, useContext } from 'react';
import type { Character } from '../../../character/character.ts';
import type { IMessageParseOptions } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerRestrictionManager } from '../../../components/gameContext/playerContextProvider.tsx';
import { Observable } from '../../../observable.ts';
import { IsActionMessage, type ChatMessagePreprocessed } from './chatMessageTypes.ts';
import type { AutocompleteDisplayData } from './commandsProcessor.ts';

export type ChatInputHandlerEditing = {
	target: number;
	restore: IMessageParseOptions;
};

export type ChatMode = {
	type: IChatType;
	raw: boolean;
};

export type IChatInputHandler = {
	setValue: (value: string) => void;
	targets: readonly Character[] | null;
	setTargets: (targets: readonly CharacterId[] | null) => void;
	editing: ChatInputHandlerEditing | null;
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

export const ChatInputContext = createContext<IChatInputHandler | null>(null);
/**
 * Whether the chat is in focus mode or not.
 * In focus mode, messages from other rooms that would be dimmed are instead hidden altogether.
 */
export const ChatFocusMode = new Observable<boolean>(false);
/**
 * Whether the chat should display the ugly, but detailed action log.
 */
export const ChatActionLog = new Observable<boolean>(false);

export function useChatFocusModeForced(): boolean | null {
	return GetChatFocusModeForced(usePlayerRestrictionManager());
}

export function GetChatFocusModeForced(playerRestrictionManager: CharacterRestrictionsManager): boolean | null {
	// eslint-disable-next-line react/destructuring-assignment
	return playerRestrictionManager.getModifierEffectsByType('setting_room_focus')[0]?.config.value ?? null;
}

export function ChatMessageShouldDim(message: ChatMessagePreprocessed): boolean {
	if (IsActionMessage(message)) {
		const differentRoom = message.rooms != null && !message.rooms.includes(message.receivedRoomId);
		return differentRoom;
	} else if (message.type === 'actionLog') {
		return false;
	} else if (message.type === 'deleted') {
		return false;
	} else {
		const isPrivate = 'to' in message && message.to;
		const differentRoom = message.room !== message.receivedRoomId;
		return !isPrivate && differentRoom;
	}
}

export function useChatActionLogDisabled(): boolean {
	return usePlayerRestrictionManager().getModifierEffectsByType('setting_chat_action_log').length > 0;
}

export function useChatInput(): IChatInputHandler {
	const context = useContext(ChatInputContext);
	AssertNotNullable(context);
	return context;
}
