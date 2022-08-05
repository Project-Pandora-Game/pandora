import React, { ReactElement } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';

export function PandoraLobby(): ReactElement {
	const roomData = useChatRoomData();
	if (roomData) {
		return <Navigate to='/chatroom' />;
	}
	return (
		<div>
			<p>You enter the amazing entrance area of Club Pandora... [work in progress]</p>
			<p>
				<Link to='/chatroom_select'>List of chatrooms</Link>
			</p>
			<p>
				<Link to='/wardrobe'>Wardrobe</Link>
			</p>
		</div>
	);
}
