import {
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	FilterItemType,
	HexColorString,
	ICharacterRoomData,
	IChatRoomFullInfo,
	IChatroomBackgroundData,
	ItemRoomDevice,
	ResolveBackground,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useMemo } from 'react';
import { Character, IChatroomCharacter } from '../../character/character';
import { shardConnectorContext, useAppearanceActionEvent } from '../gameContext/shardConnectorContextProvider';
import { Button } from '../common/button/button';
import { useEvent } from '../../common/useEvent';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { ColorInput } from '../common/colorInput/colorInput';
import { directoryConnectorContext, useCurrentAccountSettings, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useAssetManager } from '../../assets/assetManager';
import { useCharacterIsInChatroom, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { ChatRoomCharacter, useChatRoomCharacterOffsets, useChatRoomCharacterPosition } from '../chatroom/chatRoomCharacter';
import { usePlayerVisionFilters } from '../chatroom/chatRoomScene';
import { Row } from '../common/container/container';
import * as PIXI from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import { ChatRoomDevice } from '../chatroom/chatRoomDevice';

export function WardrobeCharacterPreview({ character, characterState, isPreview = false }: {
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
	isPreview?: boolean;
}): ReactElement {
	const [onClick, processing] = useAppearanceActionEvent({
		type: 'setView',
		target: character.id,
		view: characterState.requestedPose.view === 'front' ? 'back' : 'front',
	});

	const overlay = (
		<Row gap='medium' padding='medium' className='overlay pointer-events-disable'>
			<Row className='pointer-events-enable flex' gap='medium'>
				<Button className='slim iconButton'
					title='Toggle character view'
					onClick={ onClick }
					disabled={ processing }
				>
					↷
				</Button>
				<WardrobeBackgroundColorPicker />
			</Row>
			<Row className='pointer-events-enable'>
				{
					isPreview ? (
						<div className='warning'>Preview</div>
					) : null
				}
			</Row>
		</Row>
	);

	return (
		<CharacterPreview
			character={ character }
			characterState={ characterState }
			overlay={ overlay }
		/>
	);
}

export function CharacterPreview({ character, characterState, overlay }: {
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
	overlay?: ReactNode;
}): ReactElement {
	const roomInfo = useChatRoomInfo();
	const assetManager = useAssetManager();
	const accountSettings = useCurrentAccountSettings();

	const roomBackground = useMemo((): Readonly<IChatroomBackgroundData> | null => {
		if (roomInfo && accountSettings.wardrobeUseRoomBackground) {
			return ResolveBackground(assetManager, roomInfo.background);
		}
		return null;
	}, [assetManager, roomInfo, accountSettings]);

	const wardrobeBackground: number = Number.parseInt(accountSettings.wardrobeBackground.substring(1, 7), 16);

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		forwardContexts: [directoryConnectorContext, shardConnectorContext],
		backgroundColor: roomBackground ? 0x000000 : wardrobeBackground,
	}), [roomBackground, wardrobeBackground]);

	const { pivot } = useChatRoomCharacterOffsets(characterState);
	const filters = usePlayerVisionFilters(character.isPlayer());

	return (
		<GraphicsScene className='characterPreview' divChildren={ overlay } sceneOptions={ sceneOptions }>
			<GraphicsCharacter
				position={ { x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y } }
				pivot={ pivot }
				characterState={ characterState }
				filters={ filters }
			/>
			{
				roomBackground ? (
					<WardrobeRoomBackground character={ character } characterState={ characterState } roomBackground={ roomBackground } />
				) : null
			}
		</GraphicsScene>
	);
}

function WardrobeRoomBackground({
	roomBackground,
	character,
	characterState,
}: {
	roomBackground: Readonly<IChatroomBackgroundData>;
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { position, scale, errorCorrectedPivot, yOffset } = useChatRoomCharacterPosition(character.data.position, characterState, roomBackground);
	const filters = usePlayerVisionFilters(false);

	const inverseScale = 1 / scale;

	return (
		<GraphicsBackground
			zIndex={ -1000 }
			background={ roomBackground.image }
			x={ errorCorrectedPivot.x - position.x * inverseScale }
			y={ errorCorrectedPivot.y + yOffset - position.y * inverseScale }
			backgroundSize={ [roomBackground.size[0] * inverseScale, roomBackground.size[1] * inverseScale] }
			backgroundFilters={ filters }
		/>
	);
}

function WardrobeBackgroundColorPicker(): ReactElement | null {
	const accountSettings = useCurrentAccountSettings();
	const directory = useDirectoryConnector();
	const isInRoom = useCharacterIsInChatroom();

	const onChange = useEvent((newColor: HexColorString) => {
		directory.sendMessage('changeSettings', { wardrobeBackground: newColor });
	});

	// Don't show the picker, if it would have no effect
	if (accountSettings.wardrobeUseRoomBackground && isInRoom)
		return null;

	return (
		<ColorInput
			initialValue={ accountSettings.wardrobeBackground }
			onChange={ onChange }
			throttle={ 100 }
			hideTextInput={ true }
			inputColorTitle='Change background color'
		/>
	);
}

interface RoomPreviewProps {
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	info: IChatRoomFullInfo;
	overlay?: ReactNode;
}

export function RoomPreview({
	characters,
	globalState,
	info,
	overlay,
}: RoomPreviewProps): ReactElement {
	const assetManager = useAssetManager();

	const roomState = globalState.room;
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (roomState?.items.filter(FilterItemType('roomDevice')) ?? []), [roomState]);
	const roomBackground = useMemo(() => ResolveBackground(assetManager, info.background), [assetManager, info.background]);

	const borderDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.lineStyle(2, 0x404040, 0.4)
			.drawRect(0, 0, roomBackground.size[0], roomBackground.size[1]);
	}, [roomBackground]);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		forwardContexts: [directoryConnectorContext, shardConnectorContext],
		worldWidth: roomBackground.size[0],
		worldHeight: roomBackground.size[1],
		backgroundColor: 0x000000,
	}), [roomBackground]);

	return (
		<GraphicsScene
			className='roomPreview'
			sceneOptions={ sceneOptions }
			divChildren={ overlay }
		>
			<Graphics
				zIndex={ 2 }
				draw={ borderDraw }
			/>
			<Container zIndex={ 10 } sortableChildren>
				{
					characters.map((character) => (
						<ChatRoomCharacter
							key={ character.data.id }
							globalState={ globalState }
							character={ character }
							background={ roomBackground }
						/>
					))
				}
				{
					roomDevices.map((device) => (device.deployment != null ? (
						<ChatRoomDevice
							key={ device.id }
							item={ device }
							deployment={ device.deployment }
							background={ roomBackground }
						/>
					) : null))
				}
			</Container>
			<GraphicsBackground
				zIndex={ -1000 }
				background={ roomBackground.image }
				backgroundSize={ roomBackground.size }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
		</GraphicsScene>
	);
}
