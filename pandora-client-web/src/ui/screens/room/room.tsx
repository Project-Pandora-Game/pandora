import type { Immutable } from 'immer';
import { ReactElement, useCallback, useState } from 'react';
import { Column, DivContainer, Row } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { Tab, TabContainer, type TabConfig } from '../../../components/common/tabs/tabs.tsx';
import { useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView.tsx';
import { WardrobePoseGui } from '../../../components/wardrobe/views/wardrobePoseView.tsx';
import { WardrobeExternalContextProvider } from '../../../components/wardrobe/wardrobeContext.tsx';
import { RoomScene } from '../../../graphics/room/roomScene.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useIsLowScreen, useIsNarrowScreen, useIsPortrait } from '../../../styles/mediaQueries.ts';
import { Chat } from '../../components/chat/chat.tsx';
import './chatArea.scss';
import './room.scss';
import { RoomScreenContextProvider } from './roomContext.tsx';
import { PersonalSpaceControls, RoomControls } from './roomControls.tsx';
import { useRoomConstructionModeCheckProvider } from './roomPermissionChecks.tsx';

export function RoomScreen(): ReactElement | null {
	const { interfaceChatroomGraphicsRatioHorizontal, interfaceChatroomGraphicsRatioVertical } = useAccountSettings();
	const isPortrait = useIsPortrait();
	const spaceInfo = useSpaceInfo();
	useRoomConstructionModeCheckProvider();

	const chatroomGraphicsRatio = isPortrait ? interfaceChatroomGraphicsRatioVertical : interfaceChatroomGraphicsRatioHorizontal;
	const chatroomChatRatio = 10 - chatroomGraphicsRatio;

	return (
		<RoomScreenContextProvider>
			<DivContainer
				key={ spaceInfo.id ?? '_personal' }
				className='roomScreen'
				gap='none'
				direction={ isPortrait ? 'column' : 'row' }
			>
				<RoomScene className={ `room-scene flex-${chatroomGraphicsRatio}` } />
				<InteractionBox isPortrait={ isPortrait } className={ `interactionArea flex-${chatroomChatRatio}` } />
			</DivContainer>
		</RoomScreenContextProvider>
	);
}

function InteractionBox({ isPortrait, className }: {
	isPortrait: boolean;
	className?: string;
}): ReactElement {
	const [chatOpen, setChatOpen] = useState<boolean>(false);
	const { interfaceChatroomChatSplitHorizontal, interfaceChatroomChatSplitVertical } = useAccountSettings();
	const { player, playerState } = usePlayerState();
	const spaceInfo = useSpaceInfo();
	const isLowScreen = useIsLowScreen();
	const isNarrowScreen = useIsNarrowScreen();
	const isPersonalSpace = spaceInfo.id == null;

	const splitChatHorizontal =
		(interfaceChatroomChatSplitHorizontal === 'horizontal' && !isPortrait && !isLowScreen) ||
		(interfaceChatroomChatSplitVertical === 'horizontal' && isPortrait && !isLowScreen);
	const splitChatVertical =
		(interfaceChatroomChatSplitHorizontal === 'vertical' && !isPortrait && !isNarrowScreen) ||
		(interfaceChatroomChatSplitVertical === 'vertical' && isPortrait && !isNarrowScreen);

	const onTabOpen = useCallback((tab: Immutable<TabConfig>) => {
		setChatOpen(tab.name === 'Chat');
	}, []);

	return (
		<Column className={ className } gap={ splitChatHorizontal && !chatOpen ? 'tiny' : 'none' }>
			<TabContainer className={ (chatOpen && splitChatHorizontal) ? '' : 'flex-2 zero-height' } onTabOpen={ onTabOpen } collapsable>
				{
					isPersonalSpace ? (
						<Tab name='Personal space'>
							<Row className='fill-y' gap={ 'none' }>
								{
									splitChatVertical ? (
										<Chat />
									) : null
								}
								<Scrollable className='controls-container flex-1'>
									<PersonalSpaceControls />
								</Scrollable>
							</Row>
						</Tab>
					) : null
				}
				<Tab name='Chat'>
					{
						!splitChatHorizontal ? (
							<Chat />
						) : null
					}
				</Tab>
				{
					!isPersonalSpace ? (
						<Tab name='Room'>
							<Row className='fill-y' gap={ 'none' }>
								{
									splitChatVertical ? (
										<Chat />
									) : null
								}
								<Scrollable className='controls-container flex-1'>
									<RoomControls />
								</Scrollable>
							</Row>
						</Tab>
					) : null
				}
				<Tab name='Pose'>
					<Row className='fill-y' gap={ 'none' }>
						{
							splitChatVertical ? (
								<Chat />
							) : null
						}
						<WardrobeExternalContextProvider target={ player.actionSelector }>
							<WardrobePoseGui character={ player } characterState={ playerState } />
						</WardrobeExternalContextProvider>
					</Row>
				</Tab>
				<Tab name='Expressions'>
					<Row className='fill-y' gap={ 'none' }>
						{
							splitChatVertical ? (
								<Chat />
							) : null
						}
						<WardrobeExternalContextProvider target={ player.actionSelector }>
							<WardrobeExpressionGui character={ player } characterState={ playerState } />
						</WardrobeExternalContextProvider>
					</Row>
				</Tab>
			</TabContainer>
			{
				splitChatHorizontal ? (
					<Chat />
				) : null
			}
		</Column>
	);
}
