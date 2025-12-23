import type { CharacterId, ChatCharacterStatus, ICharacterRoomData } from 'pandora-common';
import { useCallback, useMemo } from 'react';
import type { IChatMessageSender } from '../../components/gameContext/gameStateContextProvider.tsx';
import { useObservable } from '../../observable.ts';
import type { ChatMessagePreprocessed } from '../../ui/components/chat/chatMessageTypes.ts';
import { useGameState } from './gameStateHooks.ts';

export function useChatMessageSender(): IChatMessageSender {
	return useGameState();
}

export function useChatMessages(): readonly ChatMessagePreprocessed[] {
	const context = useGameState();
	return useObservable(context.messages);
}

export function useChatSetPlayerStatus(): (status: ChatCharacterStatus, targets?: readonly CharacterId[]) => void {
	const gameState = useGameState();
	return useCallback((status: ChatCharacterStatus, targets?: readonly CharacterId[]) => gameState.setPlayerStatus(status, targets), [gameState]);
}

export function useChatCharacterStatus(): { data: ICharacterRoomData; status: ChatCharacterStatus; }[] {
	const gameState = useGameState();
	const characters = useObservable(gameState.characters);
	const status = useObservable(gameState.status);
	return useMemo(() => {
		const result: { data: ICharacterRoomData; status: ChatCharacterStatus; }[] = [];
		for (const c of characters) {
			const s = status.get(c.id);
			if (s != null && s !== 'none') {
				result.push({ data: c.data, status: s });
			}
		}
		return result;
	}, [characters, status]);
}
