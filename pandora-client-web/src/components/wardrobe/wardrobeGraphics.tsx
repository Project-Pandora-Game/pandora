import { Immutable } from 'immer';
import { min } from 'lodash';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	CharacterSize,
	FilterItemType,
	ICharacterRoomData,
	ItemRoomDevice,
	Rectangle,
	ResolveBackground,
	RoomBackgroundData,
	SpaceClientInfo,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import React, { ReactElement, ReactNode, useCallback, useId, useMemo, useRef, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Character, IChatroomCharacter } from '../../character/character';
import { Checkbox } from '../../common/userInteraction/checkbox';
import { Container } from '../../graphics/baseComponents/container';
import { Graphics } from '../../graphics/baseComponents/graphics';
import { PixiViewportSetupCallback, type PixiViewportRef } from '../../graphics/baseComponents/pixiViewport';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter, type GraphicsCharacterLayerFilter } from '../../graphics/graphicsCharacter';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { RoomCharacter, useRoomCharacterOffsets, useRoomCharacterPosition } from '../../graphics/room/roomCharacter';
import { RoomDevice } from '../../graphics/room/roomDevice';
import { RoomProjectionResolver, usePlayerVisionFilters, useRoomViewProjection } from '../../graphics/room/roomScene';
import { useObservable } from '../../observable';
import { serviceManagerContext } from '../../services/serviceProvider';
import { Button } from '../common/button/button';
import { Column, Row } from '../common/container/container';
import { useSpaceInfo } from '../gameContext/gameStateContextProvider';
import { useAppearanceActionEvent } from '../gameContext/shardConnectorContextProvider';
import { useWardrobeContext } from './wardrobeContext';

export function WardrobeCharacterPreview({ character, characterState, isPreview = false, allowHideItems = false }: {
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
	isPreview?: boolean;
	allowHideItems?: boolean;
}): ReactElement {
	const id = useId();
	const [onClick, processing] = useAppearanceActionEvent({
		type: 'setView',
		target: character.id,
		view: characterState.requestedPose.view === 'front' ? 'back' : 'front',
	});

	const [hideItems, setHideItems] = useState(false);

	const viewportRef = useRef<PixiViewportRef>(null);

	const overlay = useMemo(() => (
		<Row gap='medium' padding='medium' className='overlay pointer-events-disable'>
			<Row className='pointer-events-enable flex' gap='medium'>
				<Button className='slim iconButton'
					title='Toggle character view'
					onClick={ onClick }
					disabled={ processing }
				>
					↷
				</Button>
				<Button className='slim iconButton'
					title='Center the view'
					onClick={ () => {
						viewportRef.current?.center();
					} }
				>
					⊙
				</Button>
			</Row>
			<Column className='pointer-events-enable' alignX='end'>
				{
					allowHideItems ? (
						<Row className='option' gap='small' alignY='center'>
							<Checkbox
								id={ `${id}-hide-clothes` }
								checked={ hideItems }
								onChange={ setHideItems }
							/>
							<label htmlFor={ `${id}-hide-clothes` }>Hide worn items</label>
						</Row>
					) : null
				}
				{
					isPreview ? (
						<div className='warning'>Preview</div>
					) : null
				}
			</Column>
		</Row>
	), [allowHideItems, hideItems, id, isPreview, onClick, processing]);

	return (
		<CharacterPreview
			character={ character }
			characterState={ characterState }
			hideClothes={ allowHideItems && hideItems }
			overlay={ overlay }
			viewportRef={ viewportRef }
		/>
	);
}

export function CharacterPreview({ character, characterState, hideClothes = false, overlay, viewportRef }: {
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
	hideClothes?: boolean;
	overlay?: ReactNode;
	viewportRef?: React.Ref<PixiViewportRef>;
}): ReactElement {
	const spaceInfo = useSpaceInfo();
	const assetManager = useAssetManager();

	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		return ResolveBackground(assetManager, spaceInfo.config.background);
	}, [assetManager, spaceInfo]);
	const projectionResolver = useRoomViewProjection(roomBackground);

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport, { worldWidth }) => {
		viewport
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 })
			.clampZoom({
				maxWidth: worldWidth,
				minWidth: worldWidth / 4,
			})
			.bounce({
				ease: 'easeOutQuad',
				friction: 0,
				sides: 'all',
				time: 500,
				underflow: 'center',
			});
	}, []);

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [serviceManagerContext],
		backgroundColor: 0x000000,
	}), [viewportRef, viewportConfig]);

	const { pivot } = useRoomCharacterOffsets(characterState);
	const filters = usePlayerVisionFilters(character.isPlayer());

	const layerFilter = useCallback<GraphicsCharacterLayerFilter>((layer) => {
		if (hideClothes && layer.item != null) {
			const asset = layer.item.asset;
			if (asset.isType('personal') && asset.definition.bodypart == null) {
				return false;
			}
		}

		return true;
	}, [hideClothes]);

	return (
		<GraphicsScene className='characterPreview' divChildren={ overlay } sceneOptions={ sceneOptions }>
			<GraphicsCharacter
				position={ { x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y } }
				pivot={ pivot }
				characterState={ characterState }
				layerFilter={ layerFilter }
				filters={ filters }
				useBlinking
			/>
			{
				roomBackground ? (
					<WardrobeRoomBackground
						character={ character }
						characterState={ characterState }
						roomBackground={ roomBackground }
						projectionResolver={ projectionResolver }
					/>
				) : null
			}
		</GraphicsScene>
	);
}

function WardrobeRoomBackground({
	roomBackground,
	projectionResolver,
	character,
	characterState,
}: {
	roomBackground: Immutable<RoomBackgroundData>;
	projectionResolver: Immutable<RoomProjectionResolver>;
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { position, scale, pivot, yOffset } = useRoomCharacterPosition(character.data.position, characterState, projectionResolver);
	const filters = usePlayerVisionFilters(false);

	const inverseScale = 1 / scale;

	return (
		<GraphicsBackground
			zIndex={ -1000 }
			background={ roomBackground.image }
			x={ pivot.x - position.x * inverseScale }
			y={ pivot.y + yOffset - position.y * inverseScale }
			backgroundSize={ [roomBackground.imageSize[0] * inverseScale, roomBackground.imageSize[1] * inverseScale] }
			backgroundFilters={ filters }
		/>
	);
}

export function WardrobeRoomPreview({ isPreview, globalState, ...graphicsProps }: {
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	info: SpaceClientInfo;
	isPreview?: boolean;
}): ReactElement {
	const { focuser } = useWardrobeContext();
	const currentFocus = useObservable(focuser.current);

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
	info: SpaceClientInfo;
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
	const projectionResolver = useRoomViewProjection(roomBackground);

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1])
			.stroke({ width: 2, color: 0x404040, alpha: 0.4 });
	}, [roomBackground]);

	const focusArea = useMemo((): Rectangle | undefined => {
		if (focusDevice == null || !focusDevice.isDeployed())
			return undefined;

		const asset = focusDevice.asset.definition;

		let itemLeft = asset.pivot.x - 20;
		let itemRight = asset.pivot.x + 20;
		let itemTop = asset.pivot.y - 20;
		let itemBottom = asset.pivot.y + 20;

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

		const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
			focusDevice.deployment.x,
			focusDevice.deployment.y,
			focusDevice.deployment.yOffset,
		]);

		const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
		const [posX, posY] = projectionResolver.transform(deploymentX, deploymentY, 0);

		return {
			x: posX + Math.floor((itemLeft - asset.pivot.x) * scale),
			y: posY - yOffsetExtra + Math.floor((itemTop - asset.pivot.y) * scale),
			width: Math.ceil((itemRight - itemLeft) * scale),
			height: Math.ceil((itemBottom - itemTop) * scale),
		};
	}, [focusDevice, projectionResolver]);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		forwardContexts: [serviceManagerContext],
		worldWidth: focusArea?.width ?? roomBackground.imageSize[0],
		worldHeight: focusArea?.height ?? roomBackground.imageSize[1],
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
							<RoomCharacter
								key={ character.data.id }
								globalState={ globalState }
								character={ character }
								projectionResolver={ projectionResolver }
								showName={ false }
							/>
						))
					}
					{
						roomDevices.map((device) => (device.isDeployed() ? (
							<RoomDevice
								key={ device.id }
								globalState={ globalState }
								item={ device }
								deployment={ device.deployment }
								projectionResolver={ projectionResolver }
							/>
						) : null))
					}
				</Container>
				<GraphicsBackground
					zIndex={ -1000 }
					background={ roomBackground.image }
					backgroundSize={ roomBackground.imageSize }
					backgroundFilters={ usePlayerVisionFilters(false) }
				/>
			</Container>
		</GraphicsScene>
	);
}
