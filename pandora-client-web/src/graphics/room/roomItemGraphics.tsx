import { Immutable } from 'immer';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	EMPTY_ARRAY,
	GetLogger,
	GetRoomPositionBounds,
	ICharacterRoomData,
	type AssetId,
	type Item,
	type RoomBackgroundData,
	type RoomDeviceGraphicsLayer,
	type RoomPosition,
	type RoomProjectionResolver,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Character } from '../../character/character.ts';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useObservable } from '../../observable.ts';
import { useDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { PointLike } from '../common/point.ts';
import { usePixiMaskSource } from '../common/useApplyMask.ts';
import { type GraphicsGetterFunction } from '../graphicsCharacter.tsx';
import { SwapCullingDirection } from '../layers/graphicsLayerCommon.tsx';
import { GraphicsLayerRoomDeviceMesh } from '../layers/graphicsLayerMesh.tsx';
import { GraphicsLayerRoomDeviceSlot } from '../layers/graphicsLayerRoomDeviceSlot.tsx';
import { GraphicsLayerRoomDeviceSprite } from '../layers/graphicsLayerRoomDeviceSprite.tsx';
import { GraphicsLayerRoomDeviceText } from '../layers/graphicsLayerText.tsx';

export interface RoomItemGraphicsProps extends ChildrenProps {
	item: Item;
	position: RoomPosition;
	roomBackground: Immutable<RoomBackgroundData>;
	projectionResolver: RoomProjectionResolver;
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	characters: readonly Character<ICharacterRoomData>[];
	filters: () => readonly PIXI.Filter[];
	hitArea?: PIXI.Rectangle;
	eventMode?: PIXI.EventMode;
	cursor?: PIXI.Cursor;

	onPointerDown?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUp?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: PIXI.FederatedPointerEvent) => void;
	onPointerMove?: (event: PIXI.FederatedPointerEvent) => void;
}

function RoomItemGraphicsWithManager({
	item,
	position,
	roomBackground,
	projectionResolver,
	charactersInDevice,
	characters,
	filters,
	onPointerDown,
	onPointerUp,
	onPointerUpOutside,
	onPointerMove,
	children,
	cursor,
	eventMode,
	hitArea,
	graphicsGetter,
}: RoomItemGraphicsProps & {
	graphicsGetter: GraphicsGetterFunction;
}): ReactElement {
	const debugConfig = useDebugConfig();
	const asset = item.asset;

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition(position);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = useMemo((): PointLike => {
		const scaleAt = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
		return { x: scaleAt, y: scaleAt };
	}, [deploymentX, deploymentY, projectionResolver]);

	const pivot = useMemo((): PointLike => asset.isType('roomDevice') ? ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}) : ({ x: 0, y: 0 }), [asset]);

	const position2d = useMemo((): PointLike => ({ x, y: y - yOffsetExtra }), [x, y, yOffsetExtra]);

	const maskDraw = useCallback((g: PIXI.GraphicsContext) => {
		const { minX, maxX } = GetRoomPositionBounds(roomBackground);
		const ceiling = roomBackground.ceiling || (roomBackground.imageSize[1] + yOffsetExtra);
		const [x1, y1] = projectionResolver.transform(minX, deploymentY, 0);
		const [x2, y2] = projectionResolver.transform(maxX, deploymentY, 0);
		const [x3, y3] = projectionResolver.transform(maxX, deploymentY, ceiling);
		const [x4, y4] = projectionResolver.transform(minX, deploymentY, ceiling);

		g.poly([
			x1, y1,
			x2, y2,
			x3, roomBackground.ceiling ? y3 : 0,
			x4, roomBackground.ceiling ? y4 : 0,
		])
			.fill({ color: 0xffffff });
	}, [roomBackground, deploymentY, projectionResolver, yOffsetExtra]);

	const roomMask = usePixiMaskSource();

	const layers = useMemo<Immutable<RoomDeviceGraphicsLayer[]>>(() => {
		const graphics = graphicsGetter(asset.id);
		if (!graphics) {
			GetLogger('RoomDeviceGraphics').warning(`Asset ${asset.id} no graphics found`);
			return EMPTY_ARRAY;
		} else if (graphics.type === 'roomDevice') {
			return graphics.layers;
		} else if (graphics.type === 'worn') {
			return graphics.roomLayers ?? EMPTY_ARRAY;
		}

		AssertNever(graphics);
	}, [asset, graphicsGetter]);

	return (
		<>
			<Container
				position={ position2d }
				pivot={ pivot }
				scale={ scale }
				zIndex={ -deploymentY }
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
					{ debugConfig?.deviceDebugOverlay ? (
						<Container zIndex={ 99999 }>
							<RoomItemDebugGraphics pivot={ pivot } />
						</Container>
					) : null }
				</SwapCullingDirection>
			</Container>
			<Graphics
				ref={ roomMask.maskRef }
				draw={ maskDraw }
			/>
		</>
	);
}

function RoomItemDebugGraphics({ pivot }: {
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

export function RoomItemGraphics(props: RoomItemGraphicsProps): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const assetGraphics = manager?.assetGraphics;
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => assetGraphics == null ? undefined : ((id: AssetId) => assetGraphics[id]), [assetGraphics]);

	if (!graphicsGetter)
		return null;

	return <RoomItemGraphicsWithManager { ...props } graphicsGetter={ graphicsGetter } />;
}
