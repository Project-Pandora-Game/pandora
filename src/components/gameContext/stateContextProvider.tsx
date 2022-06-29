import { noop } from 'lodash';
import React, { createContext, ReactElement, useState, useMemo } from 'react';
import type { PlayerCharacter } from '../../character/player';
import type { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { ChatRoom } from './chatRoomContextProvider';
import { useNotification, NotificationSource } from './notificationContextProvider';

export const playerContext = createContext({
	player: null as PlayerCharacter | null,
	setPlayer: noop as (player: PlayerCharacter | null) => void,
});

export const chatRoomContext = createContext<ChatRoom>(null as unknown as ChatRoom);

export function StateContextProvider({ children }: ChildrenProps): ReactElement {
	const { notify } = useNotification(NotificationSource.CHAT_MESSAGE);
	const [player, setPlayer] = useState<PlayerCharacter | null>(null);
	const chatRoom = useMemo<ChatRoom>(() => new ChatRoom(notify), [notify]);

	const context = useMemo(() => ({
		player,
		setPlayer: (p: PlayerCharacter | null) => {
			chatRoom.player = p;
			setPlayer(p);
		},
	}), [player, chatRoom]);

	useDebugExpose('player', player);
	useDebugExpose('chatRoom', chatRoom);

	return (
		<playerContext.Provider value={ context }>
			<chatRoomContext.Provider value={ chatRoom }>
				{ children }
			</chatRoomContext.Provider>
		</playerContext.Provider>
	);
}
