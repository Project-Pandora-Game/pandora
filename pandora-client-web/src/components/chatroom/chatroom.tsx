import React, { ReactElement } from 'react';
import { DivContainer } from '../common/container/container';
import { ChatRoomScene } from './chatRoomScene';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { WardrobeContextProvider } from '../wardrobe/wardrobeContext';
import { WardrobeExpressionGui } from '../wardrobe/views/wardrobeExpressionsView';
import { WardrobePoseGui } from '../wardrobe/views/wardrobePoseView';
import { usePlayerState } from '../gameContext/playerContextProvider';
import { Chat } from './chat';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { ChatroomControls, PersonalRoomControls } from './chatroomControls';
import './chatroom.scss';
import { useCurrentAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { useIsPortrait } from '../../styles/mediaQueries';
import { useChatRoomInfo } from '../gameContext/chatRoomContextProvider';

export function Chatroom(): ReactElement | null {
	const { interfaceChatroomGraphicsRatioHorizontal, interfaceChatroomGraphicsRatioVertical } = useCurrentAccountSettings();
	const isPortrait = useIsPortrait();
	const roomInfo = useChatRoomInfo();

	const chatroomGraphicsRatio = isPortrait ? interfaceChatroomGraphicsRatioVertical : interfaceChatroomGraphicsRatioHorizontal;
	const chatroomChatRatio = 10 - chatroomGraphicsRatio;

	return (
		<DivContainer className='chatroom' direction={ isPortrait ? 'column' : 'row' } key={ roomInfo.id ?? '_personal' }>
			<ChatRoomScene className={ `chatroom-scene flex-${chatroomGraphicsRatio}` } />
			<InteractionBox className={ `interactionArea flex-${chatroomChatRatio}` } />
		</DivContainer>
	);
}

function InteractionBox({ className }: {
	className?: string;
}): ReactElement {
	const { player, playerState } = usePlayerState();
	const roomInfo = useChatRoomInfo();
	const isPersonalRoom = roomInfo.id == null;

	return (
		<TabContainer className={ className } collapsable>
			{
				isPersonalRoom ? (
					<Tab name='Personal room'>
						<Scrollable color='dark' className='controls-container flex-1'>
							<PersonalRoomControls />
						</Scrollable>
					</Tab>
				) : null
			}
			<Tab name='Chat'>
				<Chat />
			</Tab>
			{
				!isPersonalRoom ? (
					<Tab name='Room'>
						<Scrollable color='dark' className='controls-container flex-1'>
							<ChatroomControls />
						</Scrollable>
					</Tab>
				) : null
			}
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
