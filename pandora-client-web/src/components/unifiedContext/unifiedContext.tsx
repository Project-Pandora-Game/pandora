import React, { ReactElement } from 'react';
import { createHtmlPortalNode, InPortal } from 'react-reverse-portal';
import { ChatroomPorlatIn } from '../chatroom/chatroom';

export const ChatRoomNode = createHtmlPortalNode();

export function UnifiedContext(): ReactElement {
	return (
		<InPortal node={ ChatRoomNode }>
			<ChatroomPorlatIn />
		</InPortal>
	);
}

