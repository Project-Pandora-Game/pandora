import { AssertNever, Asset, CalculateCharacterMaxYForBackground, IChatroomBackgroundData, IRoomDeviceGraphicsLayerSlot, IRoomDeviceGraphicsLayerSprite, ItemId, RoomDeviceDeployment } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useObservable } from '../../observable';
import { ChildrenProps } from '../../common/reactTypes';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import { PointLike } from '../../graphics/graphicsCharacter';
import { Container, Graphics, Sprite, useApp } from '@pixi/react';
import { useTexture } from '../../graphics/useTexture';
import { ChatroomDebugConfig } from './chatroomDebug';
import { SwapCullingDirection } from '../../graphics/graphicsLayer';
import { Immutable } from 'immer';
import { useEvent } from '../../common/useEvent';
import _ from 'lodash';
import { ShardConnector } from '../../networking/shardConnector';

const DEVICE_WAIT_DRAG_THRESHOLD = 100; // ms

type ChatRoomDeviceProps = {
	itemId: ItemId;
	asset: Immutable<Asset<'roomDevice'>>;
	deployment: NonNullable<Immutable<RoomDeviceDeployment>>;
	debugConfig: ChatroomDebugConfig;
	background: IChatroomBackgroundData;
	shard: ShardConnector | null;
	filters: readonly PIXI.Filter[];
};

export function ChatRoomDevice({
	itemId,
	asset,
	deployment,
	debugConfig,
	background,
	shard,
	filters,
}: ChatRoomDeviceProps): ReactElement | null {
	const app = useApp();

	const setPositionRaw = useEvent((newX: number, newY: number): void => {
		const maxY = CalculateCharacterMaxYForBackground(background);

		newX = _.clamp(Math.round(newX), 0, background.size[0]);
		newY = _.clamp(Math.round(newY), 0, maxY);
		shard?.sendMessage('appearanceAction', {
			type: 'roomDeviceDeploy',
			target: {
				type: 'roomInventory',
			},
			item: {
				container: [],
				itemId,
			},
			deployment: {
				...deployment,
				x: newX,
				y: newY,
			},
		});
	});

	const setPositionThrottled = useMemo(() => _.throttle(setPositionRaw, 100), [setPositionRaw]);

	const [width, height] = background.size;
	const scaling = background.scaling;
	const x = Math.min(width, deployment.x);
	const y = Math.min(height, deployment.y);

	const scale = 1 - (y * scaling) / height;

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	const hitArea = useMemo(() => new PIXI.Rectangle(pivot.x - 50, pivot.y - 50, 100, 100), [pivot]);

	const roomDeviceContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !roomDeviceContainer.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !roomDeviceContainer.current) return;
		const dragPointerEnd = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);

		const newY = height - dragPointerEnd.y;

		setPositionThrottled(dragPointerEnd.x, newY);
	});

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		pointerDown.current = null;
	});

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (pointerDown.current !== null && Date.now() >= pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD) {
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

	// Debug graphics
	const hitboxDebugDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.beginFill(0xff0000, 0.25)
			.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
	}, [hitArea]);

	return (
		<RoomDeviceGraphics
			ref={ roomDeviceContainer }
			itemId={ itemId }
			asset={ asset }
			position={ { x, y: height - y } }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
			hitArea={ hitArea }
			eventMode='static'
			filters={ filters }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
			onPointerUpOutside={ onPointerUp }
			zIndex={ -y }
		>
			{
				!debugConfig?.characterDebugOverlay ? null : (
					<Container
						zIndex={ 99999 }
					>
						<Graphics draw={ hitboxDebugDraw } />
					</Container>
				)
			}
		</RoomDeviceGraphics>
	);
}

export interface RoomDeviceGraphicsProps extends ChildrenProps {
	itemId: ItemId;
	asset: Immutable<Asset<'roomDevice'>>;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	hitArea?: PIXI.Rectangle;
	eventMode?: PIXI.EventMode;
	filters?: readonly PIXI.Filter[];
	zIndex?: number;

	onPointerDown?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUp?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerMove?: (event: PIXI.FederatedPointerEvent) => void;
}

function RoomDeviceGraphicsWithManagerImpl({
	itemId,
	asset,
	position: positionOffset,
	scale: scaleExtra,
	pivot: pivotExtra,
	filters,
	onPointerDown,
	onPointerUp,
	onPointerUpOutside,
	onPointerMove,
	children,
	...graphicsProps
}: RoomDeviceGraphicsProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement {
	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: 0, y: 0 }), [pivotExtra]);
	const position = useMemo<PointLike>(() => ({
		x: positionOffset?.x ?? 0,
		y: positionOffset?.y ?? 0,
	}), [positionOffset]);

	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: 1, y: 1 }), [scaleExtra]);

	const actualFilters = useMemo<PIXI.Filter[] | null>(() => filters?.slice() ?? null, [filters]);

	return (
		<Container
			{ ...graphicsProps }
			ref={ ref }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			filters={ actualFilters }
			pointerdown={ onPointerDown }
			pointerup={ onPointerUp }
			pointerupoutside={ onPointerUpOutside }
			pointermove={ onPointerMove }
		>
			<SwapCullingDirection uniqueKey='filter' swap={ filters != null && filters.length > 0 }>
				<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
					{
						asset.definition.graphicsLayers.map((layer, i) => {
							let graphics: ReactElement;
							if (layer.type === 'sprite') {
								graphics = <RoomDeviceGraphicsLayerSprite layer={ layer } />;
							} else if (layer.type === 'slot') {
								graphics = <RoomDeviceGraphicsLayerSlot itemId={ itemId } layer={ layer } />;
							} else {
								AssertNever(layer);
							}
							return <Container key={ i } zIndex={ i }>{ graphics }</Container>;
						})
					}
					{ children }
				</SwapCullingDirection>
			</SwapCullingDirection>
		</Container>
	);
}

export const RoomDeviceGraphicsWithManager = React.forwardRef(RoomDeviceGraphicsWithManagerImpl);

function RoomDeviceGraphicsImpl(props: RoomDeviceGraphicsProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);

	if (!manager)
		return null;

	return <RoomDeviceGraphicsWithManager { ...props } ref={ ref } />;
}

export const RoomDeviceGraphics = React.forwardRef(RoomDeviceGraphicsImpl);

function RoomDeviceGraphicsLayerSprite({ layer, getTexture }: {
	layer: IRoomDeviceGraphicsLayerSprite;
	getTexture?: (path: string) => Promise<PIXI.Texture>;
}): ReactElement | null {

	const image = useMemo<string>(() => {
		return layer.image;
	}, [layer]);

	const texture = useTexture(image, undefined, getTexture);

	return (
		<Sprite
			x={ layer.offsetX ?? 0 }
			y={ layer.offsetY ?? 0 }
			scale={ 1 }
			texture={ texture }
			// TODO
			// tint={ color }
			// alpha={ alpha }
		/>
	);
}

function RoomDeviceGraphicsLayerSlot(_props: {
	itemId: ItemId;
	layer: IRoomDeviceGraphicsLayerSlot;
}): ReactElement | null {
	// TODO

	return null;
}
