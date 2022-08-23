import React, { createContext, ReactElement, useMemo } from 'react';
import type { PlayerCharacter } from '../../character/player';
import type { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { Observable, useObservable } from '../../observable';
import { ChatRoom } from './chatRoomContextProvider';
import { useNotification, NotificationSource } from './notificationContextProvider';

export const playerContext = createContext(new Observable<PlayerCharacter | null>(null));

export const chatRoomContext = createContext<ChatRoom>(null as unknown as ChatRoom);

export function StateContextProvider({ children }: ChildrenProps): ReactElement {
	const { notify } = useNotification(NotificationSource.CHAT_MESSAGE);

	const player = useMemo(() => new Observable<PlayerCharacter | null>(null), []);
	const chatRoom = useMemo<ChatRoom>(() => new ChatRoom(notify), [notify]);

	useDebugExpose('player', useObservable(player));
	useDebugExpose('chatRoom', chatRoom);

	return (
		<playerContext.Provider value={ player }>
			<chatRoomContext.Provider value={ chatRoom }>
				{ children }
			</chatRoomContext.Provider>
		</playerContext.Provider>
	);
}
