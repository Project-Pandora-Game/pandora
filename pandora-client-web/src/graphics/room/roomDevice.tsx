import { Container, Graphics, Sprite, useApp } from '@pixi/react';
import { Immutable } from 'immer';
import { throttle } from 'lodash';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	CharacterSize,
	CloneDeepMutable,
	Coordinates,
	EMPTY_ARRAY,
	ICharacterRoomData,
	IRoomDeviceGraphicsCharacterPosition,
	IRoomDeviceGraphicsLayerSlot,
	IRoomDeviceGraphicsLayerSprite,
	ItemRoomDevice,
	RoomDeviceDeploymentPosition,
	SpaceIdSchema,
} from 'pandora-common';
import type { FederatedPointerEvent } from 'pixi.js';
import * as PIXI from 'pixi.js';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useImageResolutionAlternative } from '../../assets/assetGraphicsCalculations';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import { BrowserStorage } from '../../browserStorage';
import { Character } from '../../character/character';
import { ChildrenProps } from '../../common/reactTypes';
import { useAsyncEvent, useEvent } from '../../common/useEvent';
import { useCharacterRestrictionsManager, useSpaceCharacters } from '../../components/gameContext/gameStateContextProvider';
import { ShardConnector } from '../../networking/shardConnector';
import { useObservable } from '../../observable';
import { useDebugConfig } from '../../ui/screens/room/roomDebug';
import { useAppearanceConditionEvaluator, useStandaloneConditionEvaluator } from '../appearanceConditionEvaluator';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter, PointLike } from '../graphicsCharacter';
import { MASK_SIZE, SwapCullingDirection, useItemColor } from '../graphicsLayer';
import { MovementHelperGraphics } from '../movementHelper';
import { useTexture } from '../useTexture';
import { EvaluateCondition } from '../utility';
import { useRoomCharacterOffsets } from './roomCharacter';
import { RoomDeviceRenderContext } from './roomDeviceContext';
import { IRoomSceneMode, RoomProjectionResolver, useCharacterDisplayFilters, usePlayerVisionFilters } from './roomScene';

const PIVOT_TO_LABEL_OFFSET = 100;
const DEVICE_WAIT_DRAG_THRESHOLD = 400; // ms

type RoomDeviceInteractiveProps = {
	globalState: AssetFrameworkGlobalState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: Immutable<RoomProjectionResolver>;
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	shard: ShardConnector | null;
	menuOpen: (character: ItemRoomDevice, data: FederatedPointerEvent) => void;

};

type RoomDeviceProps = {
	globalState: AssetFrameworkGlobalState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: Immutable<RoomProjectionResolver>;

	children?: ReactNode;
	hitArea?: PIXI.Rectangle;
	cursor?: PIXI.Cursor;
	eventMode?: PIXI.EventMode;
	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
};

export const DeviceOverlaySettingSchema = z.enum(['never', 'interactable', 'always']);
export const DeviceOverlayStateSchema = z.object({
	roomConstructionMode: z.boolean(),
	spaceId: SpaceIdSchema.nullish(),
	isPlayerAdmin: z.boolean(),
	canUseHands: z.boolean(),
});

export const DeviceOverlaySetting = BrowserStorage.create('device-overlay-toggle', 'interactable', DeviceOverlaySettingSchema);
export const DeviceOverlayState = BrowserStorage.createSession('device-overlay-state', {
	roomConstructionMode: false,
	spaceId: undefined,
	isPlayerAdmin: false,
	canUseHands: false,
}, DeviceOverlayStateSchema);

export function useIsRoomConstructionModeEnabled(): boolean {
	const { roomConstructionMode } = useObservable(DeviceOverlayState);
	return roomConstructionMode;
}

export function RoomDeviceMovementTool({
	item,
	deployment,
	projectionResolver,
	setRoomSceneMode,
	shard,
}: RoomDeviceInteractiveProps): ReactElement | null {
	const asset = item.asset;
	const app = useApp();

	const [setPositionRaw] = useAsyncEvent(async (newX: number, newY: number, newYOffset: number) => {
		if (!shard) {
			return;
		}

		[newX, newY, newYOffset] = projectionResolver.fixupPosition([newX, newY, newYOffset]);

		await shard.awaitResponse('appearanceAction', {
			type: 'roomDeviceDeploy',
			target: {
				type: 'roomInventory',
			},
			item: {
				container: [],
				itemId: item.id,
			},
			deployment: {
				deployed: true,
				position: {
					x: newX,
					y: newY,
					yOffset: newYOffset,
				},
			},
		});
	}, () => {
		/* Do nothing */
	});

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, 100), [setPositionRaw]);

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
		deployment.x,
		deployment.y,
		deployment.yOffset,
	]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const roomDeviceContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !roomDeviceContainer.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !roomDeviceContainer.current) return;

		if (pointerDownTarget.current === 'pos') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);

			const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale, 0);

			setPositionThrottled(newX, newY, yOffsetExtra);
		} else if (pointerDownTarget.current === 'offset') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current);

			const newYOffset = (dragPointerEnd.y - labelY) * -scale;

			setPositionThrottled(deployment.x, deployment.y, newYOffset);
		}
	});

	const onPointerDownPos = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'pos';
	}, []);
	const onPointerDownOffset = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'offset';
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() < pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD
		) {
			if (pointerDownTarget.current === 'pos') {
				setRoomSceneMode({ mode: 'normal' });
			} else if (pointerDownTarget.current === 'offset') {
				setPositionThrottled(deployment.x, deployment.y, 0);
			}
		}
		pointerDown.current = null;
		pointerDownTarget.current = null;
	});

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() >= pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD
		) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	useEffect(() => {
		// TODO: Move to globalpointermove once @pixi/react supports them
		app.stage.eventMode = 'static';
		app.stage.on('pointermove', onPointerMove);
		return () => {
			app.stage?.off('pointermove', onPointerMove);
		};
	}, [app, onPointerMove]);

	return (
		<Container
			ref={ roomDeviceContainer }
			position={ { x, y } }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
		>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				colorLeftRight={ 0xff0000 }
				colorUpDown={ 0x00ff00 }
				position={ { x: labelX, y: labelY } }
				scale={ { x: 1, y: 0.6 } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='move'
				pointerdown={ onPointerDownPos }
				pointerup={ onPointerUp }
				pointerupoutside={ onPointerUp }
			/>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				colorUpDown={ 0x0000ff }
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				pointerdown={ onPointerDownOffset }
				pointerup={ onPointerUp }
				pointerupoutside={ onPointerUp }
			/>
		</Container>
	);
}

export function RoomDeviceInteractive({
	globalState,
	item,
	deployment,
	projectionResolver,
	roomSceneMode,
	menuOpen,
}: RoomDeviceInteractiveProps): ReactElement | null {
	const asset = item.asset;

	const isBeingMoved = roomSceneMode.mode === 'moveDevice' && roomSceneMode.deviceItemId === item.id;

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(labelX - hitAreaRadius, labelY - hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius, labelX, labelY]);

	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			menuOpen(item, event);
		}
		pointerDown.current = null;
	});

	// Overlay graphics
	const defaultView = useObservable(DeviceOverlaySetting);
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const showOverlaySetting = roomConstructionMode ? 'always' : defaultView;

	const canInteractNormally = Object.keys(asset.definition.slots).length > 0;
	const enableMenu = !isBeingMoved && (canInteractNormally || showOverlaySetting === 'always');
	const showMenuHelper = enableMenu && (
		showOverlaySetting === 'always' ||
		(showOverlaySetting === 'interactable' && canInteractNormally)
	);

	const deviceMenuHelperDraw = useCallback((g: PIXI.Graphics) => {
		if (!showMenuHelper) {
			g.clear();
			return;
		}

		g.clear()
			.beginFill(roomConstructionMode ? 0xff0000 : 0x000075, roomConstructionMode ? 0.7 : 0.2)
			.drawCircle(0, 0, hitAreaRadius)
			.beginFill(roomConstructionMode ? 0x000000 : 0x0000ff, roomConstructionMode ? 0.8 : 0.4)
			.drawPolygon([
				-30, 10,
				5, -40,
				5, -5,
				30, -5,
				-5, 40,
				-5, 10,
			]);
	}, [showMenuHelper, roomConstructionMode, hitAreaRadius]);

	return (
		<RoomDevice
			globalState={ globalState }
			item={ item }
			deployment={ deployment }
			projectionResolver={ projectionResolver }
			hitArea={ hitArea }
			cursor={ enableMenu ? 'pointer' : 'none' }
			eventMode={ enableMenu ? 'static' : 'none' }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
		>
			{
				enableMenu ? (
					<Graphics
						zIndex={ 99998 }
						draw={ deviceMenuHelperDraw }
						position={ { x: labelX, y: labelY } }
					/>
				) : null
			}
		</RoomDevice>
	);
}

export function RoomDevice({
	globalState,
	item,
	deployment,
	projectionResolver,

	children,
	hitArea,
	cursor,
	eventMode,
	onPointerDown,
	onPointerUp,
}: RoomDeviceProps): ReactElement | null {
	const asset = item.asset;
	const debugConfig = useDebugConfig();

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
		deployment.x,
		deployment.y,
		deployment.yOffset,
	]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	return (
		<RoomDeviceRenderContext.Provider value={ item }>
			<RoomDeviceGraphics
				globalState={ globalState }
				item={ item }
				position={ { x, y: y - yOffsetExtra } }
				scale={ { x: scale, y: scale } }
				pivot={ pivot }
				hitArea={ hitArea }
				eventMode={ eventMode }
				cursor={ cursor }
				onPointerDown={ onPointerDown }
				onPointerUp={ onPointerUp }
				onPointerUpOutside={ onPointerUp }
				zIndex={ -deploymentY }
			>
				{ children }
				{
					!debugConfig?.deviceDebugOverlay ? null : (
						<Container
							zIndex={ 99999 }
						>
							<Graphics
								draw={ (g) => {
									g.clear()
										// Vertical guide line
										.lineStyle({ color: 0xffff00, width: 2, alpha: 0.5 })
										.moveTo(pivot.x, pivot.y - Math.max(100, pivot.y))
										.lineTo(pivot.x, pivot.y + 100)
										// Ground line
										.lineStyle({ color: 0xffff00, width: 2, alpha: 1 })
										.moveTo(pivot.x - Math.max(100, pivot.x), pivot.y)
										.lineTo(pivot.x + Math.max(100, pivot.x), pivot.y)
										// Pivot point (wanted)
										.beginFill(0xffff00)
										.lineStyle({ color: 0x000000, width: 1 })
										.drawCircle(pivot.x, pivot.y, 5);
								} }
							/>
						</Container>
					)
				}
			</RoomDeviceGraphics>
		</RoomDeviceRenderContext.Provider>
	);
}

export interface RoomDeviceGraphicsProps extends ChildrenProps {
	item: ItemRoomDevice;
	globalState: AssetFrameworkGlobalState;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	hitArea?: PIXI.Rectangle;
	eventMode?: PIXI.EventMode;
	cursor?: PIXI.Cursor;
	zIndex?: number;

	onPointerDown?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUp?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerMove?: (event: PIXI.FederatedPointerEvent) => void;
}

function RoomDeviceGraphicsWithManagerImpl({
	item,
	globalState,
	position: positionOffset,
	scale: scaleExtra,
	pivot: pivotExtra,
	onPointerDown,
	onPointerUp,
	onPointerUpOutside,
	onPointerMove,
	children,
	cursor,
	eventMode,
	hitArea,
	...graphicsProps
}: RoomDeviceGraphicsProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement {
	const asset = item.asset;
	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: 0, y: 0 }), [pivotExtra]);
	const position = useMemo<PointLike>(() => ({
		x: positionOffset?.x ?? 0,
		y: positionOffset?.y ?? 0,
	}), [positionOffset]);

	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: 1, y: 1 }), [scaleExtra]);

	return (
		<Container
			{ ...graphicsProps }
			ref={ ref }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			cursor={ cursor ?? 'default' }
			eventMode={ eventMode ?? 'auto' }
			hitArea={ hitArea ?? null }
			pointerdown={ onPointerDown }
			pointerup={ onPointerUp }
			pointerupoutside={ onPointerUpOutside }
			pointermove={ onPointerMove }
		>
			<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
				{
					asset.definition.graphicsLayers.map((layer, i) => {
						let graphics: ReactElement;
						if (layer.type === 'sprite') {
							graphics = <RoomDeviceGraphicsLayerSprite item={ item } layer={ layer } />;
						} else if (layer.type === 'slot') {
							graphics = <RoomDeviceGraphicsLayerSlot globalState={ globalState } item={ item } layer={ layer } />;
						} else {
							AssertNever(layer);
						}
						return <Container key={ i } zIndex={ i }>{ graphics }</Container>;
					})
				}
				{ children }
			</SwapCullingDirection>
		</Container>
	);
}

const RoomDeviceGraphicsWithManager = React.forwardRef(RoomDeviceGraphicsWithManagerImpl);

function RoomDeviceGraphicsImpl(props: RoomDeviceGraphicsProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);

	if (!manager)
		return null;

	return <RoomDeviceGraphicsWithManager { ...props } ref={ ref } />;
}

const RoomDeviceGraphics = React.forwardRef(RoomDeviceGraphicsImpl);

function RoomDeviceGraphicsLayerSprite({ item, layer, getTexture }: {
	item: ItemRoomDevice;
	layer: Immutable<IRoomDeviceGraphicsLayerSprite>;
	getTexture?: (path: string) => PIXI.Texture;
}): ReactElement | null {

	const evaluator = useStandaloneConditionEvaluator(item.assetManager);

	const image = useMemo<string>(() => {
		return layer.imageOverrides?.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? layer.image;
	}, [evaluator, item, layer]);

	const offset = useMemo<Coordinates | undefined>(() => {
		return layer.offsetOverrides?.find((o) => EvaluateCondition(o.condition, (c) => evaluator.evalCondition(c, item)))?.offset ?? layer.offset;
	}, [evaluator, item, layer]);

	const {
		image: resizedImage,
		scale,
	} = useImageResolutionAlternative(image);

	const texture = useTexture(resizedImage, undefined, getTexture);

	const { color, alpha } = useItemColor(EMPTY_ARRAY, item, layer.colorizationKey);

	const filters = usePlayerVisionFilters(false);
	const actualFilters = useMemo<PIXI.Filter[] | null>(() => filters?.slice() ?? null, [filters]);

	return (
		<Sprite
			x={ offset?.x ?? 0 }
			y={ offset?.y ?? 0 }
			scale={ scale }
			texture={ texture }
			tint={ color }
			alpha={ alpha }
			filters={ actualFilters }
		/>
	);
}

function RoomDeviceGraphicsLayerSlot({ item, layer, globalState }: {
	item: ItemRoomDevice;
	layer: Immutable<IRoomDeviceGraphicsLayerSlot>;
	globalState: AssetFrameworkGlobalState;
}): ReactElement | null {
	const characterId = item.slotOccupancy.get(layer.slot);
	const characters = useSpaceCharacters();
	const characterState = useMemo(() => (characterId != null ? globalState.characters.get(characterId) : undefined), [globalState, characterId]);

	if (!characterId)
		return null;

	const character = characters?.find((c) => c.id === characterId);

	if (!character || !characterState)
		return null;

	return (
		<RoomDeviceGraphicsLayerSlotCharacter
			item={ item }
			layer={ layer }
			character={ character }
			characterState={ characterState }
		/>
	);
}

function RoomDeviceGraphicsLayerSlotCharacter({ item, layer, character, characterState }: {
	item: ItemRoomDevice;
	layer: Immutable<IRoomDeviceGraphicsLayerSlot>;
	character: Character<ICharacterRoomData>;
	characterState: AssetFrameworkCharacterState;
}): ReactElement | null {
	const debugConfig = useDebugConfig();
	const playerFilters = usePlayerVisionFilters(character.isPlayer());
	const characterFilters = useCharacterDisplayFilters(character);
	const filters = useMemo(() => [...playerFilters, ...characterFilters], [playerFilters, characterFilters]);

	const devicePivot = item.asset.definition.pivot;

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const effectiveCharacterPosition = useMemo<IRoomDeviceGraphicsCharacterPosition>(() => {
		return layer.characterPositionOverrides
			?.find((override) => EvaluateCondition(override.condition, (c) => evaluator.evalCondition(c, item)))?.position
			?? layer.characterPosition;
	}, [evaluator, item, layer]);

	const x = devicePivot.x + effectiveCharacterPosition.offsetX;
	const y = devicePivot.y + effectiveCharacterPosition.offsetY;

	const {
		baseScale,
		pivot,
		rotationAngle,
	} = useRoomCharacterOffsets(characterState);

	const scale = baseScale * (effectiveCharacterPosition.relativeScale ?? 1);

	const backView = characterState.actualPose.view === 'back';

	const scaleX = backView ? -1 : 1;

	const actualPivot = useMemo((): PointLike => {
		const result: PointLike = CloneDeepMutable(effectiveCharacterPosition.disablePoseOffset ? CHARACTER_PIVOT_POSITION : pivot);
		if (effectiveCharacterPosition.pivotOffset != null) {
			result.x += effectiveCharacterPosition.pivotOffset.x;
			result.y += effectiveCharacterPosition.pivotOffset.y;
		}
		return result;
	}, [effectiveCharacterPosition, pivot]);

	// Character must be in this device, otherwise we skip rendering it here
	// (could happen if character left and rejoined the room without device equipped)
	const roomDeviceLink = useCharacterRestrictionsManager(characterState, character, (rm) => rm.getRoomDeviceLink());
	if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== layer.slot)
		return null;

	return (
		<GraphicsCharacter
			characterState={ characterState }
			position={ { x, y } }
			pivot={ actualPivot }
			scale={ { x: scale * scaleX, y: scale } }
			angle={ rotationAngle }
			filters={ filters }
		>
			{
				!debugConfig?.characterDebugOverlay ? null : (
					<Container
						zIndex={ 99999 }
					>
						<Graphics
							draw={ (g) => {
								g.clear()
									// Mask area
									.lineStyle({ color: 0xffff00, width: 2 })
									.drawRect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
									// Character canvas standard area
									.lineStyle({ color: 0x00ff00, width: 2 })
									.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
									// Pivot point
									.beginFill(0xffaa00)
									.lineStyle({ color: 0x000000, width: 1 })
									.drawCircle(actualPivot.x, actualPivot.y, 5);
							} }
						/>
					</Container>
				)
			}
		</GraphicsCharacter>
	);
}
