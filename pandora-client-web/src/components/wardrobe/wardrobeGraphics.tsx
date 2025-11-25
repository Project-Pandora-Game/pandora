import classNames from 'classnames';
import { Immutable } from 'immer';
import {
	Assert,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	ICharacterRoomData,
	ItemRoomDevice,
	Rectangle,
	RoomBackgroundData,
	SpaceClientInfo,
	type AssetFrameworkRoomState,
	type RoomProjectionResolver,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useId, useMemo, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Character } from '../../character/character.ts';
import { Checkbox } from '../../common/userInteraction/checkbox.tsx';
import { Container } from '../../graphics/baseComponents/container.ts';
import { PixiViewportSetupCallback, type PixiViewportRef } from '../../graphics/baseComponents/pixiViewport.tsx';
import { CalculateRoomDeviceGraphicsBounds } from '../../graphics/common/roomDeviceBounds.ts';
import { usePlayerVisionFilters } from '../../graphics/common/visionFilters.tsx';
import { GraphicsBackground } from '../../graphics/graphicsBackground.tsx';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter, type GraphicsCharacterLayerFilter } from '../../graphics/graphicsCharacter.tsx';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene.tsx';
import { useGraphicsSmoothMovementEnabled } from '../../graphics/graphicsSettings.tsx';
import { CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION, useRoomCharacterOffsets, useRoomCharacterPosition } from '../../graphics/room/roomCharacter.tsx';
import { useRoomViewProjection } from '../../graphics/room/roomProjection.tsx';
import { RoomGraphics } from '../../graphics/room/roomScene.tsx';
import { UseTextureGetterOverride } from '../../graphics/useTexture.ts';
import { useObservable } from '../../observable.ts';
import { serviceManagerContext } from '../../services/serviceProvider.tsx';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { THEME_NORMAL_BACKGROUND } from '../gameContext/interfaceSettingsProvider.tsx';
import { useAppearanceActionEvent } from '../gameContext/shardConnectorContextProvider.tsx';
import { WardrobeActionAttemptOverlay } from './views/wardrobeActionAttempt.tsx';
import { WardrobeCurrentEffectsView } from './views/wardrobeCurrentEffectsView.tsx';
import { useWardrobeContext } from './wardrobeContext.tsx';

export function WardrobeCharacterPreview({ character, characterState, globalState, isPreview = false, allowHideItems = false, showCharacterEffects = false }: {
	character: Character;
	characterState: AssetFrameworkCharacterState;
	globalState: AssetFrameworkGlobalState;
	isPreview?: boolean;
	allowHideItems?: boolean;
	showCharacterEffects?: boolean;
}): ReactElement {
	const id = useId();
	const [onClick, processing] = useAppearanceActionEvent({
		type: 'pose',
		target: character.id,
		view: characterState.requestedPose.view === 'front' ? 'back' : 'front',
	});

	const [hideItems, setHideItems] = useState(false);

	const viewportRef = useRef<PixiViewportRef>(null);

	const overlay = useMemo(() => (
		<Column
			gap='medium'
			padding='medium'
			className={ classNames(
				'overlay pointer-events-disable',
				showCharacterEffects ? 'solidOverlay' : null,
			) }
		>
			<Row gap='medium' alignY='start' className='fill-x'>
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
			{
				showCharacterEffects ? (
					<WardrobeCurrentEffectsView character={ character } globalState={ globalState } />
				) : (
					<div className='flex-1' />
				)
			}
			<Row alignX='center' className='fill-x'>
				<WardrobeActionAttemptOverlay character={ character } />
			</Row>
		</Column>
	), [allowHideItems, showCharacterEffects, hideItems, id, isPreview, onClick, processing, character, globalState]);

	return (
		<CharacterPreview
			character={ character }
			characterState={ characterState }
			globalState={ globalState }
			hideClothes={ allowHideItems && hideItems }
			overlay={ overlay }
			viewportRef={ viewportRef }
		/>
	);
}

export function CharacterPreview({ character, characterState, globalState, hideClothes = false, overlay, viewportRef }: {
	character: Character;
	characterState: AssetFrameworkCharacterState;
	globalState: AssetFrameworkGlobalState;
	hideClothes?: boolean;
	overlay?: ReactNode;
	viewportRef?: React.Ref<PixiViewportRef>;
}): ReactElement {
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const roomState = globalState.space.getRoom(characterState.currentRoom);
	Assert(roomState != null, 'Character room not found');
	const roomBackground = roomState.roomBackground;
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
		viewport.fit();
		viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
	}, []);

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [serviceManagerContext, UseTextureGetterOverride],
		backgroundColor: Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16),
	}), [viewportRef, viewportConfig]);

	const { pivot } = useRoomCharacterOffsets(characterState);
	const filters = usePlayerVisionFilters(character.isPlayer());

	const layerFilter = useCallback<GraphicsCharacterLayerFilter>((layer) => {
		if (layer.item != null) {
			const asset = layer.item.asset;
			if (asset.isType('roomDeviceWearablePart')) {
				return false;
			}
			if (hideClothes && asset.isType('personal')) {
				return false;
			}
		}

		return true;
	}, [hideClothes]);

	const movementTransitionDuration = !smoothMovementEnabled ? 0 : CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION;

	return (
		<GraphicsScene className='characterPreview' divChildren={ overlay } sceneOptions={ sceneOptions }>
			{ roomBackground ? (
				<WardrobeRoomBackground
					characterState={ characterState }
					roomBackground={ roomBackground }
					projectionResolver={ projectionResolver }
				/>
			) : null }
			<Container>
				<GraphicsCharacter
					position={ { x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y } }
					pivot={ pivot }
					characterState={ characterState }
					layerFilter={ layerFilter }
					filters={ filters }
					useBlinking
					movementTransitionDuration={ movementTransitionDuration }
				/>
			</Container>
		</GraphicsScene>
	);
}

function WardrobeRoomBackground({
	roomBackground,
	projectionResolver,
	characterState,
}: {
	roomBackground: Immutable<RoomBackgroundData>;
	projectionResolver: RoomProjectionResolver;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { position, scale, pivot, yOffset } = useRoomCharacterPosition(characterState, projectionResolver);
	const filters = usePlayerVisionFilters(false);

	const inverseScale = 1 / scale;

	return (
		<Container
			x={ pivot.x - position.x * inverseScale }
			y={ pivot.y + yOffset - position.y * inverseScale }
			scale={ inverseScale }
		>
			<GraphicsBackground
				background={ roomBackground }
				backgroundFilters={ filters }
			/>
		</Container>
	);
}

export function WardrobeRoomPreview({ isPreview, globalState, ...graphicsProps }: {
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	roomState: AssetFrameworkRoomState;
	info: SpaceClientInfo;
	isPreview?: boolean;
}): ReactElement {
	const { focuser, currentRoomSelector } = useWardrobeContext();
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

		const item = globalState.getItems(currentRoomSelector)?.find((i) => i.id === itemId);

		if (item == null || !item.isType('roomDevice') || !item.isDeployed())
			return undefined;

		return item;
	}, [currentFocus, currentRoomSelector, globalState]);

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
	roomState: AssetFrameworkRoomState;
	overlay?: ReactNode;
	focusDevice?: ItemRoomDevice;
}

export function RoomPreview({
	characters,
	globalState,
	roomState,
	overlay,
	focusDevice,
}: RoomPreviewProps): ReactElement {
	const roomBackground = roomState.roomBackground;
	const projectionResolver = useRoomViewProjection(roomBackground);
	const graphicsManager = useObservable(GraphicsManagerInstance);

	const focusArea = useMemo((): Rectangle | undefined => {
		if (focusDevice == null || !focusDevice.isDeployed())
			return undefined;

		const graphics = graphicsManager?.assetGraphics[focusDevice.asset.id];
		if (graphics?.type !== 'roomDevice')
			return undefined;

		const { x, y, width, height } = CalculateRoomDeviceGraphicsBounds(focusDevice.asset, graphics);

		const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
			focusDevice.deployment.x,
			focusDevice.deployment.y,
			focusDevice.deployment.yOffset,
		]);

		const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
		const [posX, posY] = projectionResolver.transform(deploymentX, deploymentY, 0);

		return {
			x: posX + Math.floor(scale * x),
			y: posY - yOffsetExtra + Math.floor(scale * y),
			width: Math.ceil(width * scale),
			height: Math.ceil(height * scale),
		};
	}, [focusDevice, graphicsManager, projectionResolver]);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		forwardContexts: [serviceManagerContext, UseTextureGetterOverride],
		worldWidth: focusArea?.width ?? roomBackground.imageSize[0],
		worldHeight: focusArea?.height ?? roomBackground.imageSize[1],
		backgroundColor: Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16),
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
			>
				<RoomGraphics
					room={ roomState }
					characters={ characters }
					globalState={ globalState }
					showCharacterNames={ false }
				/>
			</Container>
		</GraphicsScene>
	);
}
