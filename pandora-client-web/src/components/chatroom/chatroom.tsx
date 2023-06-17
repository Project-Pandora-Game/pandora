import React, { ReactElement } from 'react';
import { Navigate } from 'react-router';
import { useCharacterIsInChatroom } from '../gameContext/chatRoomContextProvider';
import { Row } from '../common/container/container';
import { ChatRoomScene } from './chatRoomScene';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { WardrobeContextProvider, WardrobeExpressionGui, WardrobePoseGui } from '../wardrobe/wardrobe';
import { usePlayerState } from '../gameContext/playerContextProvider';
import { Chat } from './chat';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { ChatroomControls } from './chatroomControls';
import './chatroom.scss';

export function Chatroom(): ReactElement | null {
	const isInChatRoom = useCharacterIsInChatroom();

	if (!isInChatRoom) {
		return <Navigate to='/chatroom_select' />;
	}

	return (
		<Row className='chatroom'>
			<ChatRoomScene className={ `chatroom-scene flex-4` } />
			<InteractionBox className={ `interactionArea flex-1` } />
		</Row>
	);
}

function InteractionBox({ className }: {
	className?: string;
}): ReactElement {
	const { player, playerState } = usePlayerState();

	return (
		<TabContainer className={ className }>
			<Tab name='Chat'>
				<Chat />
			</Tab>
			<Tab name='Room'>
				<Scrollable color='dark'>
					<ChatroomControls />
				</Scrollable>
			</Tab>
			<Tab name='Pose'>
				<WardrobeContextProvider player={ player } target={ player }>
					<WardrobePoseGui character={ player } characterState={ playerState } />
				</WardrobeContextProvider>
			</Tab>
			<Tab name='Expressions'>
				<WardrobeContextProvider player={ player } target={ player }>
					<WardrobeExpressionGui character={ player } characterState={ playerState } />
				</WardrobeContextProvider>
			</Tab>
		</TabContainer>
	);
}
