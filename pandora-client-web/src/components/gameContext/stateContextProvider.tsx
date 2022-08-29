import React, { createContext, ReactElement, useEffect, useMemo } from 'react';
import type { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { ChatRoom } from './chatRoomContextProvider';
import { useNotification, NotificationSource } from './notificationContextProvider';

export const chatRoomContext = createContext<ChatRoom | null>(null);

export function StateContextProvider({ children }: ChildrenProps): ReactElement {
	const { notify } = useNotification(NotificationSource.CHAT_MESSAGE);

	const chatRoom = useMemo<ChatRoom>(() => new ChatRoom(), []);

	useDebugExpose('chatRoom', chatRoom);
	useEffect(() => {
		return chatRoom.on('messageNotify', notify);
	}, [chatRoom, notify]);

	return (
		<chatRoomContext.Provider value={ chatRoom }>
			{ children }
		</chatRoomContext.Provider>
	);
}
