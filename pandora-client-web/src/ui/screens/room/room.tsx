import { ReactElement } from 'react';
import { DivContainer } from '../../../components/common/container/container';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs';
import { useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView';
import { WardrobePoseGui } from '../../../components/wardrobe/views/wardrobePoseView';
import { WardrobeExternalContextProvider } from '../../../components/wardrobe/wardrobeContext';
import { RoomScene } from '../../../graphics/room/roomScene';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import { useIsPortrait } from '../../../styles/mediaQueries';
import { Chat } from '../../components/chat/chat';
import './chatArea.scss';
import './room.scss';
import { RoomScreenContextProvider } from './roomContext';
import { PersonalSpaceControls, RoomControls } from './roomControls';
import { useRoomConstructionModeCheckProvider } from './roomPermissionChecks';

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
