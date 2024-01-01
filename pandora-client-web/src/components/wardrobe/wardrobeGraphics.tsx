import {
	AssertNever,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	CharacterSize,
	FilterItemType,
	HexColorString,
	ICharacterRoomData,
	IChatRoomClientInfo,
	IChatroomBackgroundData,
	ItemRoomDevice,
	Rectangle,
	ResolveBackground,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useMemo } from 'react';
import { Character, IChatroomCharacter } from '../../character/character';
import { shardConnectorContext, useAppearanceActionEvent } from '../gameContext/shardConnectorContextProvider';
import { Button } from '../common/button/button';
import { useEvent } from '../../common/useEvent';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { CHARACTER_BASE_Y_OFFSET, CHARACTER_PIVOT_POSITION, GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { ColorInput } from '../common/colorInput/colorInput';
import { directoryConnectorContext, useCurrentAccountSettings, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useAssetManager } from '../../assets/assetManager';
import { useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { ChatRoomCharacter, useChatRoomCharacterOffsets, useChatRoomCharacterPosition } from '../chatroom/chatRoomCharacter';
import { usePlayerVisionFilters } from '../chatroom/chatRoomScene';
import { Row } from '../common/container/container';
import * as PIXI from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import { ChatRoomDevice } from '../chatroom/chatRoomDevice';
import { useWardrobeContext } from './wardrobeContext';
import { useObservable } from '../../observable';
import { min } from 'lodash';
import { Immutable } from 'immer';

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

	const roomBackground = useMemo((): Immutable<IChatroomBackgroundData> | null => {
		if (roomInfo && accountSettings.wardrobeUseRoomBackground) {
			return ResolveBackground(assetManager, roomInfo.config.background);
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
	roomBackground: Immutable<IChatroomBackgroundData>;
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

	const onChange = useEvent((newColor: HexColorString) => {
		directory.sendMessage('changeSettings', { wardrobeBackground: newColor });
	});

	// Don't show the picker, if it would have no effect
	if (accountSettings.wardrobeUseRoomBackground)
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

export function WardrobeRoomPreview({ isPreview, globalState, ...graphicsProps }: {
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	info: IChatRoomClientInfo;
	isPreview?: boolean;
}): ReactElement {
	const { focus } = useWardrobeContext();
	const currentFocus = useObservable(focus);

	const overlay = (
		<Row gap='medium' padding='medium' alignX='end' className='overlay pointer-events-disable'>
			<Row className='pointer-events-enable'>
				{
					isPreview ? (
						<div className='warning'>Preview</div>
					) : null
				}
			</Row>
		</Row>
	);

	const focusDevice = useMemo((): ItemRoomDevice | undefined => {
		const itemId = currentFocus.container.length > 0 ? currentFocus.container[0].item : currentFocus.itemId;

		if (itemId == null)
			return undefined;

		const item = globalState.room?.items.find((i) => i.id === itemId);

		if (item == null || !item.isType('roomDevice') || !item.isDeployed())
			return undefined;

		return item;
	}, [currentFocus, globalState]);

	return (
		<RoomPreview
			{ ...graphicsProps }
			globalState={ globalState }
			overlay={ overlay }
			focusDevice={ focusDevice }
		/>
	);
}

interface RoomPreviewProps {
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	info: IChatRoomClientInfo;
	overlay?: ReactNode;
	focusDevice?: ItemRoomDevice;
}

export function RoomPreview({
	characters,
	globalState,
	info,
	overlay,
	focusDevice,
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

	const focusArea = useMemo((): Rectangle | undefined => {
		if (focusDevice == null || !focusDevice.isDeployed())
			return undefined;

		const asset = focusDevice.asset.definition;

		let itemLeft = asset.pivot.x - 20;
		let itemRight = asset.pivot.x + 20;
		let itemTop = asset.pivot.y - 20;
		let itemBottom = asset.pivot.y + CHARACTER_BASE_Y_OFFSET + 20;

		for (const layer of asset.graphicsLayers) {
			if (layer.type === 'sprite') {
				const offsetX = Math.min(layer.offset?.x ?? 0, min(layer.offsetOverrides?.map((o) => o.offset.x)) ?? layer.offset?.x ?? 0);
				const offsetY = Math.min(layer.offset?.y ?? 0, min(layer.offsetOverrides?.map((o) => o.offset.y)) ?? layer.offset?.y ?? 0);

				itemLeft = Math.min(itemLeft, offsetX);
				itemTop = Math.min(itemTop, offsetY);
				if (offsetX < asset.pivot.x) {
					const width = 2 * (asset.pivot.x - offsetX);
					itemRight = Math.max(itemRight, offsetX + width);
				}
			} else if (layer.type === 'slot') {
				for (const position of [layer.characterPosition, ...(layer.characterPositionOverrides ?? []).map((o) => o.position)]) {
					const characterScale = position.relativeScale ?? 1;
					const x = asset.pivot.x + position.offsetX - characterScale * (CHARACTER_PIVOT_POSITION.x + (position.pivotOffset?.x ?? 0));
					const y = asset.pivot.y + position.offsetY - characterScale * (CHARACTER_PIVOT_POSITION.y + (position.pivotOffset?.y ?? 0));

					itemLeft = Math.min(itemLeft, x);
					itemTop = Math.min(itemTop, y);
					const width = Math.ceil(characterScale * CharacterSize.WIDTH);
					itemRight = Math.max(itemRight, x + width);
					const height = Math.ceil(characterScale * CharacterSize.HEIGHT);
					itemBottom = Math.max(itemBottom, y + height);
				}
			} else {
				AssertNever(layer);
			}
		}

		const [backgroundWidth, backgroundHeight] = roomBackground.size;
		const scaling = roomBackground.scaling;
		const deploymentX = Math.min(backgroundWidth, focusDevice.deployment.x);
		const deploymentY = Math.min(backgroundHeight, focusDevice.deployment.y);
		const yOffsetExtra = Math.round(focusDevice.deployment.yOffset);
		const scale = 1 - (deploymentY * scaling) / backgroundHeight;

		return {
			x: deploymentX + Math.floor((itemLeft - asset.pivot.x) * scale),
			y: backgroundHeight - deploymentY - yOffsetExtra + Math.floor((itemTop - (asset.pivot.y + CHARACTER_BASE_Y_OFFSET)) * scale),
			width: Math.ceil((itemRight - itemLeft) * scale),
			height: Math.ceil((itemBottom - itemTop) * scale),
		};
	}, [focusDevice, roomBackground]);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		forwardContexts: [directoryConnectorContext, shardConnectorContext],
		worldWidth: focusArea?.width ?? roomBackground.size[0],
		worldHeight: focusArea?.height ?? roomBackground.size[1],
		backgroundColor: 0x000000,
	}), [focusArea, roomBackground]);

	return (
		<GraphicsScene
			className='roomPreview'
			sceneOptions={ sceneOptions }
			divChildren={ overlay }
		>
			<Container
				x={ -(focusArea?.x ?? 0) }
				y={ -(focusArea?.y ?? 0) }
				sortableChildren
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
						roomDevices.map((device) => (device.isDeployed() ? (
							<ChatRoomDevice
								key={ device.id }
								globalState={ globalState }
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
			</Container>
		</GraphicsScene>
	);
}
