import classNames from 'classnames';
import { AssertNever } from 'pandora-common';
import { ReactElement, useMemo, useState } from 'react';
import { Column, DivContainer } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { Tabulation, type TabConfig } from '../../../components/common/tabs/tabs.tsx';
import { LocalErrorBoundary } from '../../../components/error/localErrorBoundary.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView.tsx';
import { WardrobePoseGui } from '../../../components/wardrobe/views/wardrobePoseView.tsx';
import { WardrobeExternalContextProvider } from '../../../components/wardrobe/wardrobeContext.tsx';
import { RoomSceneInteractive } from '../../../graphics/room/roomSceneInteractive.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useSpaceInfo } from '../../../services/gameLogic/gameStateHooks.ts';
import { useIsLowScreen, useIsNarrowScreen, useIsPortrait } from '../../../styles/mediaQueries.ts';
import { Chat } from '../../components/chat/chat.tsx';
import './chatArea.scss';
import './room.scss';
import { RoomScreenContextProvider } from './roomContextProvider.tsx';
import { PersonalSpaceControls, RoomControls } from './roomControls.tsx';

export function RoomScreen(): ReactElement | null {
	const { interfaceChatroomGraphicsRatioHorizontal, interfaceChatroomGraphicsRatioVertical } = useAccountSettings();
	const isPortrait = useIsPortrait();
	const spaceInfo = useSpaceInfo();

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
				<RoomSceneInteractive className={ `room-scene flex-${chatroomGraphicsRatio}` } />
				<InteractionBox isPortrait={ isPortrait } className={ `interactionArea flex-${chatroomChatRatio}` } />
			</DivContainer>
		</RoomScreenContextProvider>
	);
}

type InteractionBoxTab = 'chat' | 'room' | 'pose' | 'expressions';

function InteractionBox({ isPortrait, className }: {
	isPortrait: boolean;
	className?: string;
}): ReactElement {
	const { interfaceChatroomChatSplitHorizontal, interfaceChatroomChatSplitVertical } = useAccountSettings();
	const spaceInfo = useSpaceInfo();
	const isLowScreen = useIsLowScreen();
	const isNarrowScreen = useIsNarrowScreen();
	const isPersonalSpace = spaceInfo.id == null;

	const [tab, setTab] = useState<InteractionBoxTab>(isPersonalSpace ? 'room' : 'chat');

	const chatSplitSetting = isPortrait ? interfaceChatroomChatSplitVertical : interfaceChatroomChatSplitHorizontal;
	const splitChatHorizontal = chatSplitSetting === 'horizontal' && !isLowScreen;
	const splitChatVertical = chatSplitSetting === 'vertical' && !isNarrowScreen;

	const tabs = useMemo((): (TabConfig | undefined)[] => [
		(isPersonalSpace ? {
			name: 'Personal space',
			active: tab === 'room',
			onClick: () => setTab('room'),
		} : undefined),
		{
			name: 'Chat',
			active: tab === 'chat',
			onClick: () => setTab('chat'),
		},
		(!isPersonalSpace ? {
			name: 'Room',
			active: tab === 'room',
			onClick: () => setTab('room'),
		} : undefined),
		{
			name: 'Pose',
			active: tab === 'pose',
			onClick: () => setTab('pose'),
		},
		{
			name: 'Expressions',
			active: tab === 'expressions',
			onClick: () => setTab('expressions'),
		},
	], [tab, isPersonalSpace]);

	return (
		<Column className={ className } gap='none'>
			<Tabulation
				tabs={ tabs }
				collapsable
			/>
			<DivContainer
				direction={ splitChatVertical ? 'row' : 'column' }
				reverse={ splitChatVertical }
				gap='tiny'
				className='fill-x zero-height flex-1'
			>
				<LocalErrorBoundary>
					{
						// Chat is handled separately
						tab === 'chat' ? null : (
							<Column
								className={ classNames(
									'fit',
									(
										splitChatHorizontal ? 'flex-2 zero-height' :
										splitChatVertical ? 'flex-1' :
										'fill'
									),
								) }
							>
								{
									tab === 'room' ? (
										isPersonalSpace ? (
											<Scrollable className='controls-container flex-1'>
												<PersonalSpaceControls />
											</Scrollable>
										) : (
											<Scrollable className='controls-container flex-1'>
												<RoomControls />
											</Scrollable>
										)
									) : tab === 'pose' ? (
										<InteractionBoxPose />
									) : tab === 'expressions' ? (
										<InteractionBoxExpressions />
									) : AssertNever(tab)
								}
							</Column>
						)
					}
					{
						tab === 'chat' || splitChatHorizontal || splitChatVertical ? (
							<Chat />
						) : null
					}
				</LocalErrorBoundary>
			</DivContainer>
		</Column>
	);
}

function InteractionBoxPose(): ReactElement {
	const { player, playerState } = usePlayerState();

	return (
		<WardrobeExternalContextProvider target={ player.actionSelector }>
			<WardrobePoseGui character={ player } characterState={ playerState } />
		</WardrobeExternalContextProvider>
	);
}

function InteractionBoxExpressions(): ReactElement {
	const { player, playerState } = usePlayerState();

	return (
		<WardrobeExternalContextProvider target={ player.actionSelector }>
			<WardrobeExpressionGui character={ player } characterState={ playerState } />
		</WardrobeExternalContextProvider>
	);
}
