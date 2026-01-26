import { throttle } from 'lodash-es';
import {
	EMPTY_ARRAY,
	type AssetFrameworkRoomState,
	type Item,
	type RoomPosition,
	type RoomProjectionResolver,
} from 'pandora-common';
import { OutlineFilter } from 'pixi-filters';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { useEvent } from '../../common/useEvent.ts';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { WardrobeItemName } from '../../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { ROOM_CONTEXT_MENU_OFFSET, useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { DeviceOverlaySetting, useIsRoomConstructionModeEnabled } from '../../ui/screens/room/roomState.ts';
import { Container } from '../baseComponents/container.ts';
import type { HitscanEvent } from '../common/hitscan/hitscanContext.ts';
import { useDefineHitscanTarget, type HitscanTargetProps } from '../common/hitscan/hitscanTarget.tsx';
import { PointLike } from '../common/point.ts';
import { CalculateRoomDeviceGraphicsBounds } from '../common/roomDeviceBounds.ts';
import { MovementHelperGraphics } from '../movementHelper.tsx';
import { RoomItemGraphics } from './roomItemGraphics.tsx';

const PIVOT_TO_LABEL_OFFSET = 100;
const DEVICE_WAIT_DRAG_THRESHOLD = 400; // ms

type RoomItemInteractiveProps = {
	roomState: AssetFrameworkRoomState;
	item: Item;
	position: RoomPosition;
	projectionResolver: RoomProjectionResolver;
	filters: () => readonly PIXI.Filter[];
};

type RoomItemProps = {
	roomState: AssetFrameworkRoomState;
	item: Item;
	position: RoomPosition;
	projectionResolver: RoomProjectionResolver;
	/** Filters to apply to each room layer. Slots do not have filters applied to. */
	filters: () => readonly PIXI.Filter[];
	/** Filters to apply to the whole device, including any slots. Note, that these still do not apply to supplied children. */
	containerFilters?: () => readonly PIXI.Filter[];

	children?: ReactNode;
	hitArea?: PIXI.Rectangle;
	cursor?: PIXI.Cursor;
	eventMode?: PIXI.EventMode;
};

export function RoomItemMovementTool({
	roomState,
	item,
	position,
	projectionResolver,
}: Pick<RoomItemInteractiveProps, 'roomState' | 'item' | 'position' | 'projectionResolver'>): ReactElement | null {
	const asset = item.asset;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		[newX, newY, newYOffset] = projectionResolver.fixupPosition([newX, newY, newYOffset]);

		execute({
			type: 'moveItem',
			target: { type: 'room', roomId: roomState.id },
			item: { container: [], itemId: item.id },
			personalItemDeployment: {
				deployed: true,
				position: [newX, newY, newYOffset],
			},
		});
	}, [execute, roomState.id, item.id, projectionResolver]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition(position);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	const pivot = useMemo((): PointLike => asset.isType('roomDevice') ? ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}) : ({ x: 0, y: 0 }), [asset]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const roomDeviceContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const [heldPos, setHeldPos] = useState(false);
	const [hoverPos, setHoverPos] = useState(false);
	const [heldOffset, setHeldOffset] = useState(false);
	const [hoverOffset, setHoverOffset] = useState(false);

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

			setPositionThrottled(position[0], position[1], newYOffset);
		}
	});

	const onPointerDownPos = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		setHeldPos(true);
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'pos';
	}, []);
	const onPointerDownOffset = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		setHeldOffset(true);
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
				setPositionThrottled(position[0], position[1], 0);
			}
		}
		pointerDown.current = null;
		pointerDownTarget.current = null;
		setHeldPos(false);
		setHeldOffset(false);
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
				theme={ heldPos ? 'active' : hoverPos ? 'hover' : 'normal' }
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
				onpointerenter={ useCallback(() => {
					setHoverPos(true);
				}, []) }
				onpointerleave={ useCallback(() => {
					setHoverPos(false);
				}, []) }
			/>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				theme={ heldOffset ? 'active' : hoverOffset ? 'hover' : 'normal' }
				colorUpDown={ 0x0000ff }
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
				onpointerenter={ useCallback(() => {
					setHoverOffset(true);
				}, []) }
				onpointerleave={ useCallback(() => {
					setHoverOffset(false);
				}, []) }
			/>
		</Container>
	);
}

export const RoomItemInteractive = memo(function RoomItemInteractive({
	roomState,
	item,
	position,
	projectionResolver,
	filters,
}: RoomItemInteractiveProps): ReactElement | null {
	const graphicsManager = useObservable(GraphicsManagerInstance);
	const { interfaceAccentColor } = useAccountSettings();
	const asset = item.asset;

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

	const isBeingMoved = roomSceneMode.mode === 'moveItem' && roomSceneMode.itemId === item.id;

	const hitArea = useMemo(() => {
		const graphics = graphicsManager?.assetGraphics[asset.id];

		const bounds = CalculateRoomDeviceGraphicsBounds((graphics?.type === 'worn' ? graphics.roomLayers : undefined) ?? []);
		return new PIXI.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
	}, [graphicsManager, asset.id]);

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition(position);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = useMemo((): PointLike => {
		const scaleAt = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
		return { x: scaleAt, y: scaleAt };
	}, [deploymentX, deploymentY, projectionResolver]);

	const position2d = useMemo((): PointLike => ({ x, y: y - yOffsetExtra }), [x, y, yOffsetExtra]);

	// Selection graphics
	const defaultView = useObservable(DeviceOverlaySetting);
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const showOverlaySetting = roomConstructionMode ? 'always' : defaultView;

	const enableMenu = !isBeingMoved && showOverlaySetting === 'always';

	/** Global position at which user pressed button/touched */
	const pointerDown = useRef<Readonly<HitscanEvent> | null>(null);

	const { held, hover } = useDefineHitscanTarget(useMemo((): HitscanTargetProps | null => {
		if (!enableMenu)
			return null;

		const roomHitArea = new PIXI.Rectangle(
			position2d.x + scale.x * hitArea.x,
			position2d.y + scale.y * hitArea.y,
			scale.x * hitArea.width,
			scale.y * hitArea.height,
		);

		return {
			hitArea: roomHitArea,
			// Intentionally not stopping propagation, as we want people to be able to move background even through the item
			stopClickPropagation: false,
			// eslint-disable-next-line react/no-unstable-nested-components
			getSelectionButtonContents() {
				return (
					<WardrobeItemName item={ item } />
				);
			},
			onPointerDown(pos) {
				pointerDown.current = pos;
			},
			onPointerUp(pos) {
				if (pointerDown.current !== null) {
					openContextMenu({
						type: 'item',
						room: roomState.id,
						itemId: item.id,
						position: {
							x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
							y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
						},
					});
				}
				pointerDown.current = null;
			},
			onPointerUpOutside() {
				pointerDown.current = null;
			},
			onClick(pos, fromSelectionMenu) {
				if (fromSelectionMenu) {
					openContextMenu({
						type: 'item',
						room: roomState.id,
						itemId: item.id,
						position: {
							x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
							y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
						},
					});
				}
			},
			onDrag(pos, start) {
				const movedDistance = Math.hypot(pos.x - start.x, pos.y - start.y);
				// If we moved at least 10 pixels, then cancel hold
				if (movedDistance >= 10) {
					pointerDown.current = null;
				}
			},
		};
	}, [enableMenu, hitArea, roomState.id, item, openContextMenu, position2d, scale]));

	const containerFilters = useCallback(() => {
		if (enableMenu && (hover || held)) {
			const outlineColor = new Color('#222222').mixSrgb(new Color(interfaceAccentColor), held ? 0.65 : 0.35).toHex();

			return [
				new OutlineFilter({
					color: outlineColor,
					thickness: 4,
				}),
			];
		}

		return [];
	}, [enableMenu, held, hover, interfaceAccentColor]);

	return (
		<RoomItem
			roomState={ roomState }
			item={ item }
			position={ position }
			projectionResolver={ projectionResolver }
			filters={ filters }
			containerFilters={ containerFilters }
			hitArea={ hitArea }
			cursor={ enableMenu ? 'pointer' : 'none' }
			eventMode={ enableMenu ? 'static' : 'none' }
		/>
	);
});

export const RoomItem = memo(function RoomItem({
	roomState,
	item,
	position,
	projectionResolver,
	filters,
	containerFilters,

	children,
	hitArea,
	cursor,
	eventMode,
}: RoomItemProps): ReactElement | null {
	return (
		<RoomItemGraphics
			item={ item }
			position={ position }
			roomBackground={ roomState.roomBackground }
			projectionResolver={ projectionResolver }
			charactersInDevice={ EMPTY_ARRAY }
			characters={ EMPTY_ARRAY }
			filters={ filters }
			containerFilters={ containerFilters }
			hitArea={ hitArea }
			eventMode={ eventMode }
			cursor={ cursor }
		>
			{ children }
		</RoomItemGraphics>
	);
});
