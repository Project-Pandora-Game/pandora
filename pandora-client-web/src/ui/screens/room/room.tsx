import React, { ReactElement } from 'react';
import { DivContainer } from '../../../components/common/container/container';
import { RoomScene } from '../../../graphics/room/roomScene';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs';
import { WardrobeContextProvider } from '../../../components/wardrobe/wardrobeContext';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView';
import { WardrobePoseGui } from '../../../components/wardrobe/views/wardrobePoseView';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { Chat } from '../../components/chat/chat';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar';
import { RoomControls, PersonalSpaceControls, useRoomConstructionModeCheck } from './roomControls';
import { useCurrentAccountSettings } from '../../../components/gameContext/directoryConnectorContextProvider';
import { useIsPortrait } from '../../../styles/mediaQueries';
import { useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import './room.scss';

export function RoomScreen(): ReactElement | null {
	const { interfaceChatroomGraphicsRatioHorizontal, interfaceChatroomGraphicsRatioVertical } = useCurrentAccountSettings();
	const isPortrait = useIsPortrait();
	const spaceInfo = useSpaceInfo();
	useRoomConstructionModeCheck();

	const chatroomGraphicsRatio = isPortrait ? interfaceChatroomGraphicsRatioVertical : interfaceChatroomGraphicsRatioHorizontal;
	const chatroomChatRatio = 10 - chatroomGraphicsRatio;

	return (
		<DivContainer className='roomScreen' direction={ isPortrait ? 'column' : 'row' } key={ spaceInfo.id ?? '_personal' }>
			<RoomScene className={ `room-scene flex-${chatroomGraphicsRatio}` } />
			<InteractionBox className={ `interactionArea flex-${chatroomChatRatio}` } />
		</DivContainer>
	);
}

function InteractionBox({ className }: {
	className?: string;
}): ReactElement {
	const { player, playerState } = usePlayerState();
	const spaceInfo = useSpaceInfo();
	const isPersonalSpace = spaceInfo.id == null;

	return (
		<TabContainer className={ className } collapsable>
			{
				isPersonalSpace ? (
					<Tab name='Personal space'>
						<Scrollable color='dark' className='controls-container flex-1'>
							<PersonalSpaceControls />
						</Scrollable>
					</Tab>
				) : null
			}
			<Tab name='Chat'>
				<Chat />
			</Tab>
			{
				!isPersonalSpace ? (
					<Tab name='Room'>
						<Scrollable color='dark' className='controls-container flex-1'>
							<RoomControls />
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
