import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	CharacterSize,
	Coordinates,
	EMPTY_ARRAY,
	GetLogger,
	GetRoomPositionBounds,
	ICharacterRoomData,
	ItemRoomDevice,
	RoomDeviceDeploymentPosition,
	RoomDeviceGraphicsLayerSlot,
	RoomDeviceGraphicsLayerSprite,
	type AssetFrameworkRoomState,
	type AssetId,
	type RoomDeviceGraphicsLayer,
	type RoomProjectionResolver,
} from 'pandora-common';
import type { FederatedPointerEvent } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useImageResolutionAlternative } from '../../assets/assetGraphicsCalculations.ts';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Character } from '../../character/character.ts';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { useDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { DeviceOverlaySetting, SettingDisplayCharacterName, useIsRoomConstructionModeEnabled } from '../../ui/screens/room/roomState.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, useStandaloneConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { Sprite } from '../baseComponents/sprite.ts';
import { PointLike } from '../common/point.ts';
import type { TransitionedContainerCustomProps } from '../common/transitions/transitionedContainer.ts';
import { usePixiApplyMaskSource, usePixiMaskSource, type PixiMaskSource } from '../common/useApplyMask.ts';
import { useCharacterDisplayFilters, useCharacterDisplayStyle, usePlayerVisionFilters } from '../common/visionFilters.tsx';
import { GraphicsCharacter, type GraphicsGetterFunction } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MASK_SIZE } from '../layers/graphicsLayerAlphaImageMesh.tsx';
import { SwapCullingDirection, useItemColor } from '../layers/graphicsLayerCommon.tsx';
import { GraphicsLayerRoomDeviceMesh } from '../layers/graphicsLayerMesh.tsx';
import { GraphicsLayerRoomDeviceText } from '../layers/graphicsLayerText.tsx';
import { MovementHelperGraphics } from '../movementHelper.tsx';
import { useTexture } from '../useTexture.ts';
import { EvaluateCondition } from '../utility.ts';
import { CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL, RoomCharacterLabel } from './roomCharacter.tsx';
import { CalculateCharacterDeviceSlotPosition, useRoomCharacterOffsets } from './roomCharacterPosition.ts';

const PIVOT_TO_LABEL_OFFSET = 100;
const DEVICE_WAIT_DRAG_THRESHOLD = 400; // ms

type RoomDeviceInteractiveProps = {
	characters: readonly Character<ICharacterRoomData>[];
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	roomState: AssetFrameworkRoomState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: RoomProjectionResolver;
	filters: () => readonly PIXI.Filter[];
};

type RoomDeviceProps = {
	characters: readonly Character<ICharacterRoomData>[];
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	roomState: AssetFrameworkRoomState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: RoomProjectionResolver;
	filters: () => readonly PIXI.Filter[];

	children?: ReactNode;
	hitArea?: PIXI.Rectangle;
	cursor?: PIXI.Cursor;
	eventMode?: PIXI.EventMode;
	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
};

export function RoomDeviceMovementTool({
	roomState,
	item,
	deployment,
	projectionResolver,
}: Pick<RoomDeviceInteractiveProps, 'roomState' | 'item' | 'deployment' | 'projectionResolver'>): ReactElement | null {
	const asset = item.asset;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		[newX, newY, newYOffset] = projectionResolver.fixupPosition([newX, newY, newYOffset]);

		execute({
			type: 'roomDeviceDeploy',
			target: {
				type: 'room',
				roomId: roomState.id,
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
	}, [execute, roomState.id, item.id, projectionResolver]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

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
		if (dragging.current || !roomDeviceContainer.current?.parent) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !roomDeviceContainer.current?.parent) return;

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
				onpointerdown={ onPointerDownPos }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				colorUpDown={ 0x0000ff }
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
		</Container>
	);
}

export const RoomDeviceInteractive = memo(function RoomDeviceInteractive({
	characters,
	charactersInDevice,
	roomState,
	item,
	deployment,
	projectionResolver,
	filters,
}: RoomDeviceInteractiveProps): ReactElement | null {
	const asset = item.asset;

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

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
			openContextMenu({
				type: 'device',
				room: roomState.id,
				deviceItemId: item.id,
			}, {
				x: event.pageX,
				y: event.pageY,
			});
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

	const deviceMenuHelperDraw = useCallback((g: PIXI.GraphicsContext) => {
		if (!showMenuHelper) {
			return;
		}

		g
			.circle(0, 0, hitAreaRadius)
			.fill({ color: roomConstructionMode ? 0xff0000 : 0x000075, alpha: roomConstructionMode ? 0.7 : 0.2 })
			.poly([
				-30, 10,
				5, -40,
				5, -5,
				30, -5,
				-5, 40,
				-5, 10,
			])
			.fill({ color: roomConstructionMode ? 0x000000 : 0x0000ff, alpha: roomConstructionMode ? 0.8 : 0.4 });
	}, [showMenuHelper, roomConstructionMode, hitAreaRadius]);

	const showCharacterNames = useObservable(SettingDisplayCharacterName);

	return (
		<>
			<RoomDevice
				characters={ characters }
				charactersInDevice={ charactersInDevice }
				roomState={ roomState }
				item={ item }
				deployment={ deployment }
				projectionResolver={ projectionResolver }
				filters={ filters }
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
			{
				showCharacterNames ? (
					<RoomDeviceCharacterNames
						item={ item }
						characters={ characters }
						charactersInDevice={ charactersInDevice }
						deployment={ deployment }
						projectionResolver={ projectionResolver }
					/>
				) : null
			}
		</>
	);
});

function RoomDeviceCharacterNames({
	item,
	characters,
	charactersInDevice,
	deployment,
	projectionResolver,
}: Pick<RoomDeviceProps, 'item' | 'characters' | 'charactersInDevice' | 'deployment' | 'projectionResolver'>): ReactElement {
	const {
		interfaceChatroomCharacterNameFontSize,
	} = useAccountSettings();

	let fontScale: number;
	switch (interfaceChatroomCharacterNameFontSize) {
		case 'xs': fontScale = 0.6; break;
		case 's': fontScale = 1.0; break;
		case 'm': fontScale = 1.4; break;
		case 'l': fontScale = 1.8; break;
		case 'xl': fontScale = 2.2; break;
		default:
			AssertNever(interfaceChatroomCharacterNameFontSize);
	}

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
		deployment.x,
		deployment.y,
		deployment.yOffset,
	]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	return (
		<>
			{
				useMemo(() => {
					if (characters == null)
						return null;

					const result: ReactNode[] = [];
					const spacing = 42 * fontScale;

					for (const slot of Object.keys(item.asset.definition.slots)) {
						const characterId = item.slotOccupancy.get(slot);
						const character = characterId != null ? characters.find((c) => c.id === characterId) : undefined;
						const characterState = charactersInDevice.find((c) => c.id === characterId);

						if (character == null || characterState == null)
							continue;

						// Character must be in this device, otherwise we skip the name
						// (could happen if character left and rejoined the room without device equipped)
						const roomDeviceLink = characterState.getRoomDeviceWearablePart()?.roomDeviceLink ?? null;
						if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== slot)
							continue;

						result.push(<RoomDeviceCharacterName
							key={ character.id }
							character={ character }
							x={ x }
							y={ y - yOffsetExtra + scale * ((result.length + 0.5) * spacing + PIVOT_TO_LABEL_OFFSET + 85) }
							zIndex={ -deploymentY - 0.5 }
							scale={ scale }
							spacing={ spacing }
						/>);
					}

					return result;
				}, [characters, charactersInDevice, deploymentY, fontScale, item, scale, x, y, yOffsetExtra])
			}
		</>
	);
}

function RoomDeviceCharacterName({ character, x, y, zIndex, scale, spacing }: {
	character: Character;
	x: number;
	y: number;
	zIndex: number;
	scale: number;
	spacing: number;
}): ReactElement | null {
	const {
		openContextMenu,
	} = useRoomScreenContext();

	const characterDisplayStyle = useCharacterDisplayStyle(character);

	const [hover, setHover] = useState(false);
	const [held, setHeld] = useState(false);

	if (characterDisplayStyle === 'hidden')
		return null;

	return (
		<Container
			key={ character.id }
			position={ { x, y } }
			scale={ { x: scale, y: scale } }
			cursor='pointer'
			eventMode='static'
			hitArea={ new PIXI.Rectangle(-100, -0.5 * spacing, 200, spacing) }
			onpointerdown={ (ev) => {
				if (ev.button !== 1) {
					ev.stopPropagation();
					setHeld(true);
				}
			} }
			onpointerup={ (ev) => {
				if (held) {
					ev.stopPropagation();
					setHeld(false);
					openContextMenu({
						type: 'character',
						character,
					}, {
						x: ev.pageX,
						y: ev.pageY,
					});
				}
			} }
			onpointerupoutside={ () => {
				setHeld(false);
			} }
			onpointerenter={ () => {
				setHover(true);
			} }
			onpointerleave={ () => {
				setHover(false);
			} }
			zIndex={ zIndex }
		>
			<RoomCharacterLabel
				character={ character }
				theme={ held ? 'active' : hover ? 'hover' : 'normal' }
			/>
		</Container>
	);
}

export const RoomDevice = memo(function RoomDevice({
	characters,
	charactersInDevice,
	roomState,
	item,
	deployment,
	projectionResolver,
	filters,

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

	const background = roomState.roomBackground;
	const maskDraw = useCallback((g: PIXI.GraphicsContext) => {
		const { minX, maxX } = GetRoomPositionBounds(background);
		const ceiling = background.ceiling || (background.imageSize[1] + yOffsetExtra);
		const [x1, y1] = projectionResolver.transform(minX, deploymentY, 0);
		const [x2, y2] = projectionResolver.transform(maxX, deploymentY, 0);
		const [x3, y3] = projectionResolver.transform(maxX, deploymentY, ceiling);
		const [x4, y4] = projectionResolver.transform(minX, deploymentY, ceiling);

		g.poly([
			x1, y1,
			x2, y2,
			x3, background.ceiling ? y3 : 0,
			x4, background.ceiling ? y4 : 0,
		])
			.fill({ color: 0xffffff });
	}, [background, deploymentY, projectionResolver, yOffsetExtra]);

	const roomMask = usePixiMaskSource();

	return (
		<>
			<RoomDeviceGraphics
				characters={ characters }
				charactersInDevice={ charactersInDevice }
				item={ item }
				filters={ filters }
				position={ useMemo((): PointLike => ({ x, y: y - yOffsetExtra }), [x, y, yOffsetExtra]) }
				scale={ useMemo((): PointLike => ({ x: scale, y: scale }), [scale]) }
				pivot={ pivot }
				hitArea={ hitArea }
				eventMode={ eventMode }
				cursor={ cursor }
				onPointerDown={ onPointerDown }
				onPointerUp={ onPointerUp }
				onPointerUpOutside={ onPointerUp }
				zIndex={ -deploymentY }
				roomMask={ roomMask }
			>
				{ children }
				{
					!debugConfig?.deviceDebugOverlay ? null : (
						<Container zIndex={ 99999 }>
							<RoomDeviceDebugGraphics pivot={ pivot } />
						</Container>
					)
				}
			</RoomDeviceGraphics>
			<Graphics
				ref={ roomMask.maskRef }
				draw={ maskDraw }
			/>
		</>
	);
});

function RoomDeviceDebugGraphics({ pivot }: {
	pivot: Readonly<PointLike>;
}): ReactElement {
	const debugGraphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			// Vertical guide line
			.moveTo(pivot.x, pivot.y - Math.max(100, pivot.y))
			.lineTo(pivot.x, pivot.y + 100)
			.stroke({ color: 0xffff00, width: 1, alpha: 0.5, pixelLine: true })
			// Ground line
			.moveTo(pivot.x - Math.max(100, pivot.x), pivot.y)
			.lineTo(pivot.x + Math.max(100, pivot.x), pivot.y)
			.stroke({ color: 0xffff00, width: 1, alpha: 1, pixelLine: true })
			// Pivot point (wanted)
			.circle(pivot.x, pivot.y, 5)
			.fill(0xffff00)
			.stroke({ color: 0x000000, width: 1 });
	}, [pivot]);

	return (
		<Graphics draw={ debugGraphicsDraw } />
	);
}

export interface RoomDeviceGraphicsProps extends ChildrenProps {
	item: ItemRoomDevice;
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	characters: readonly Character<ICharacterRoomData>[];
	filters: () => readonly PIXI.Filter[];
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	hitArea?: PIXI.Rectangle;
	eventMode?: PIXI.EventMode;
	cursor?: PIXI.Cursor;
	zIndex?: number;
	roomMask?: PixiMaskSource;

	onPointerDown?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUp?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerMove?: (event: PIXI.FederatedPointerEvent) => void;
}

function RoomDeviceGraphicsWithManager({
	item,
	charactersInDevice,
	characters,
	filters,
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
	roomMask,
	graphicsGetter,
	...graphicsProps
}: RoomDeviceGraphicsProps & {
	graphicsGetter: GraphicsGetterFunction;
}): ReactElement {
	const asset = item.asset;
	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: 0, y: 0 }), [pivotExtra]);
	const position = useMemo<PointLike>(() => ({
		x: positionOffset?.x ?? 0,
		y: positionOffset?.y ?? 0,
	}), [positionOffset]);

	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: 1, y: 1 }), [scaleExtra]);

	const layers = useMemo<Immutable<RoomDeviceGraphicsLayer[]>>(() => {
		const graphics = graphicsGetter(asset.id);
		if (!graphics) {
			GetLogger('RoomDeviceGraphics').warning(`Asset ${asset.id} no graphics found`);
			return EMPTY_ARRAY;
		} else if (graphics.type !== 'roomDevice') {
			GetLogger('RoomDeviceGraphics').warning(`Asset ${asset.id} is room device, but graphics has type ${graphics.type}`);
			return EMPTY_ARRAY;
		}

		return graphics.layers;
	}, [asset, graphicsGetter]);

	return (
		<Container
			{ ...graphicsProps }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			cursor={ cursor ?? 'default' }
			eventMode={ eventMode ?? 'auto' }
			hitArea={ hitArea ?? null }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUpOutside }
			onpointermove={ onPointerMove }
		>
			<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
				<Container zIndex={ 0 }>
					{ useMemo(() => layers.map((layer, i) => {
						if (layer.type === 'sprite') {
							return <GraphicsLayerRoomDeviceSprite key={ i } item={ item } layer={ layer } roomMask={ roomMask } getFilters={ filters } />;
						} else if (layer.type === 'slot') {
							return <GraphicsLayerRoomDeviceSlot key={ i } charactersInDevice={ charactersInDevice } item={ item } layer={ layer } characters={ characters } />;
						} else if (layer.type === 'text') {
							return <GraphicsLayerRoomDeviceText key={ i } item={ item } layer={ layer } getFilters={ filters } />;
						} else if (layer.type === 'mesh') {
							return <GraphicsLayerRoomDeviceMesh key={ i } item={ item } layer={ layer } roomMask={ roomMask } getFilters={ filters } />;
						}
						AssertNever(layer);
					}), [layers, item, roomMask, filters, characters, charactersInDevice]) }
				</Container>
				{ children }
			</SwapCullingDirection>
		</Container>
	);
}

function RoomDeviceGraphics(props: RoomDeviceGraphicsProps): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const assetGraphics = manager?.assetGraphics;
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => assetGraphics == null ? undefined : ((id: AssetId) => assetGraphics[id]), [assetGraphics]);

	if (!graphicsGetter)
		return null;

	return <RoomDeviceGraphicsWithManager { ...props } graphicsGetter={ graphicsGetter } />;
}

const GraphicsLayerRoomDeviceSprite = memo(function GraphicsLayerRoomDeviceSprite({ item, layer, roomMask, getFilters }: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerSprite>;
	roomMask?: PixiMaskSource;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}): ReactElement | null {

	const evaluator = useStandaloneConditionEvaluator();

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

	const texture = useTexture(resizedImage, undefined);

	const { color, alpha } = useItemColor(EMPTY_ARRAY, item, layer.colorizationKey);

	const actualFilters = useMemo<PIXI.Filter[] | undefined>(() => getFilters()?.slice(), [getFilters]);

	const applyRoomMask = usePixiApplyMaskSource(roomMask ?? null);

	return (
		<Sprite
			ref={ layer.clipToRoom ? applyRoomMask : null }
			x={ offset?.x ?? 0 }
			y={ offset?.y ?? 0 }
			scale={ scale }
			texture={ texture }
			tint={ color }
			alpha={ alpha }
			filters={ actualFilters }
		/>
	);
});

function GraphicsLayerRoomDeviceSlot({ item, layer, charactersInDevice, characters }: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerSlot>;
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	characters: readonly Character<ICharacterRoomData>[];
}): ReactElement | null {
	const characterId = item.slotOccupancy.get(layer.slot);
	const characterState = useMemo(() => (characterId != null ? charactersInDevice.find((c) => c.id === characterId) : undefined), [charactersInDevice, characterId]);

	if (!characterId)
		return null;

	const character = characters.find((c) => c.id === characterId);

	if (!character || !characterState)
		return null;

	return (
		<GraphicsLayerRoomDeviceSlotCharacter
			item={ item }
			layer={ layer }
			character={ character }
			characterState={ characterState }
		/>
	);
}

function GraphicsLayerRoomDeviceSlotCharacter({ item, layer, character, characterState }: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerSlot>;
	character: Character<ICharacterRoomData>;
	characterState: AssetFrameworkCharacterState;
}): ReactElement | null {
	const debugConfig = useDebugConfig();
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const playerFilters = usePlayerVisionFilters(character.isPlayer());
	const characterDisplayStyle = useCharacterDisplayStyle(character);
	const characterFilters = useCharacterDisplayFilters(characterDisplayStyle);
	const filters = useMemo(() => [...playerFilters, ...characterFilters], [playerFilters, characterFilters]);

	const {
		baseScale,
		pivot,
		rotationAngle,
	} = useRoomCharacterOffsets(characterState);

	const poseEvaluator = useCharacterPoseEvaluator(characterState.assetManager, characterState.actualPose);
	const evaluator = useAppearanceConditionEvaluator(poseEvaluator, characterState.items);

	const {
		position,
		pivot: actualPivot,
		scale,
	} = useMemo(() => CalculateCharacterDeviceSlotPosition({
		item,
		layer,
		characterState,
		evaluator,
		baseScale,
		pivot,
	}), [item, layer, characterState, evaluator, baseScale, pivot]);

	// Character must be in this device, otherwise we skip rendering it here
	// (could happen if character left and rejoined the room without device equipped)
	const roomDeviceLink = characterState.getRoomDeviceWearablePart()?.roomDeviceLink ?? null;
	if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== layer.slot || characterDisplayStyle === 'hidden' || characterDisplayStyle === 'name-only')
		return null;

	const movementTransitionDuration = !smoothMovementEnabled ? 0 : CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL;

	return (
		<GraphicsCharacter
			characterState={ characterState }
			position={ position }
			pivot={ actualPivot }
			scale={ scale }
			angle={ rotationAngle }
			filters={ filters }
			useBlinking
			movementTransitionDuration={ movementTransitionDuration }
			perPropertyMovementTransitionDuration={ ROOM_DEVICE_CHARACTER_TRANSITION_OVERRIDES }
		>
			{
				!debugConfig?.characterDebugOverlay ? null : (
					<Container zIndex={ 99999 }>
						<RoomDeviceLayerSlotCharacterDebugGraphics actualPivot={ actualPivot } />
					</Container>
				)
			}
		</GraphicsCharacter>
	);
}

const ROOM_DEVICE_CHARACTER_TRANSITION_OVERRIDES: TransitionedContainerCustomProps['perPropertyTransitionDuration'] = {
	angle: 0,
	scaleX: 0,
	scaleY: 0,
	x: 0,
	y: 0,
};

function RoomDeviceLayerSlotCharacterDebugGraphics({ actualPivot }: {
	actualPivot: Readonly<PointLike>;
}): ReactElement {
	const debugGraphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			// Mask area
			.rect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
			.stroke({ color: 0xffff00, width: 1, pixelLine: true })
			// Character canvas standard area
			.rect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
			.stroke({ color: 0x00ff00, width: 1, pixelLine: true })
			// Pivot point
			.circle(actualPivot.x, actualPivot.y, 5)
			.fill(0xffaa00)
			.stroke({ color: 0x000000, width: 1 });
	}, [actualPivot]);

	return (
		<Graphics draw={ debugGraphicsDraw } />
	);
}
