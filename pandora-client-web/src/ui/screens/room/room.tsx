import { ReactElement } from 'react';
import { DivContainer } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView.tsx';
import { WardrobePoseGui } from '../../../components/wardrobe/views/wardrobePoseView.tsx';
import { WardrobeExternalContextProvider } from '../../../components/wardrobe/wardrobeContext.tsx';
import { RoomScene } from '../../../graphics/room/roomScene.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useIsPortrait } from '../../../styles/mediaQueries.ts';
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
				<InteractionBox className={ `interactionArea flex-${chatroomChatRatio}` } />
			</DivContainer>
		</RoomScreenContextProvider>
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
						<Scrollable className='controls-container flex-1'>
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
						<Scrollable className='controls-container flex-1'>
							<RoomControls />
						</Scrollable>
					</Tab>
				) : null
			}
			<Tab name='Pose'>
				<WardrobeExternalContextProvider target={ player.actionSelector }>
					<WardrobePoseGui character={ player } characterState={ playerState } />
				</WardrobeExternalContextProvider>
			</Tab>
			<Tab name='Expressions'>
				<WardrobeExternalContextProvider target={ player.actionSelector }>
					<WardrobeExpressionGui character={ player } characterState={ playerState } />
				</WardrobeExternalContextProvider>
			</Tab>
		</TabContainer>
	);
}
