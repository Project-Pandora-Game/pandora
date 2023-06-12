import { AssertNever, AssetFrameworkCharacterState, CalculateCharacterMaxYForBackground, CharacterSize, EMPTY_ARRAY, IChatroomBackgroundData, IRoomDeviceGraphicsLayerSlot, IRoomDeviceGraphicsLayerSprite, ItemRoomDevice, RoomDeviceDeployment } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useObservable } from '../../observable';
import { ChildrenProps } from '../../common/reactTypes';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import { GraphicsCharacter, PointLike } from '../../graphics/graphicsCharacter';
import { Container, Graphics, Sprite, useApp } from '@pixi/react';
import { useTexture } from '../../graphics/useTexture';
import { ChatroomDebugConfig } from './chatroomDebug';
import { SwapCullingDirection, useItemColor } from '../../graphics/graphicsLayer';
import { Immutable } from 'immer';
import { useEvent } from '../../common/useEvent';
import _ from 'lodash';
import { ShardConnector } from '../../networking/shardConnector';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { Character, useCharacterAppearanceView } from '../../character/character';
import { useCharacterRestrictionsManager, useCharacterState, useChatRoomCharacters, useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import type { FederatedPointerEvent } from 'pixi.js';

const DEVICE_WAIT_DRAG_THRESHOLD = 100; // ms

type ChatRoomDeviceProps = {
	item: ItemRoomDevice;
	deployment: NonNullable<Immutable<RoomDeviceDeployment>>;
	debugConfig: ChatroomDebugConfig;
	background: IChatroomBackgroundData;
	shard: ShardConnector | null;
	menuOpen: (character: ItemRoomDevice, data: FederatedPointerEvent) => void;
	filters: readonly PIXI.Filter[];
};

export const RoomDeviceRenderContext = React.createContext<ItemRoomDevice | null>(null);

export function ChatRoomDevice({
	item,
	deployment,
	debugConfig,
	background,
	shard,
	menuOpen,
	filters,
}: ChatRoomDeviceProps): ReactElement | null {
	const asset = item.asset;
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
				itemId: item.id,
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

	const onPointerUp = useEvent((event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD) {
			menuOpen(item, event);
		}
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
			.beginFill(0xff0000, 0.30)
			.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height)
			.beginFill(0x000000, 0.40)
			.drawPolygon([
				hitArea.x + 45, hitArea.y + 30,
				hitArea.x + 45 - 15, hitArea.y + 30,
				hitArea.x + 45 - 15, hitArea.y + 30 - 25,
				hitArea.x + 45 - 50, hitArea.y + 0.5 * hitArea.height,
				hitArea.x + 45 - 15, hitArea.y - 30 + hitArea.height + 25,
				hitArea.x + 45 - 15, hitArea.y - 30 + hitArea.height,
				hitArea.x + 45, hitArea.y - 30 + hitArea.height,
			])
			.drawPolygon([
				hitArea.x + hitArea.width - 45, hitArea.y + 30,
				hitArea.x + hitArea.width - 45 + 15, hitArea.y + 30,
				hitArea.x + hitArea.width - 45 + 15, hitArea.y + 30 - 25,
				hitArea.x + hitArea.width - 45 + 50, hitArea.y + 0.5 * hitArea.height,
				hitArea.x + hitArea.width - 45 + 15, hitArea.y - 30 + hitArea.height + 25,
				hitArea.x + hitArea.width - 45 + 15, hitArea.y - 30 + hitArea.height,
				hitArea.x + hitArea.width - 45, hitArea.y - 30 + hitArea.height,
			]);
	}, [hitArea]);

	return (
		<RoomDeviceRenderContext.Provider value={ item }>
			<RoomDeviceGraphics
				ref={ roomDeviceContainer }
				item={ item }
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
					!debugConfig?.deviceDebugOverlay ? null : (
						<Container
							zIndex={ 99999 }
						>
							<Graphics draw={ hitboxDebugDraw } />
						</Container>
					)
				}
			</RoomDeviceGraphics>
		</RoomDeviceRenderContext.Provider>
	);
}

export interface RoomDeviceGraphicsProps extends ChildrenProps {
	item: ItemRoomDevice;
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
	item,
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
	const asset = item.asset;
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
			cursor='pointer'
		>
			<SwapCullingDirection uniqueKey='filter' swap={ filters != null && filters.length > 0 }>
				<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
					{
						asset.definition.graphicsLayers.map((layer, i) => {
							let graphics: ReactElement;
							if (layer.type === 'sprite') {
								graphics = <RoomDeviceGraphicsLayerSprite item={ item } layer={ layer } />;
							} else if (layer.type === 'slot') {
								graphics = <RoomDeviceGraphicsLayerSlot item={ item } layer={ layer } />;
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

function RoomDeviceGraphicsLayerSprite({ item, layer, getTexture }: {
	item: ItemRoomDevice;
	layer: IRoomDeviceGraphicsLayerSprite;
	getTexture?: (path: string) => Promise<PIXI.Texture>;
}): ReactElement | null {

	const image = useMemo<string>(() => {
		return layer.image;
	}, [layer]);

	const texture = useTexture(image, undefined, getTexture);

	const { color, alpha } = useItemColor(EMPTY_ARRAY, item, layer.colorizationKey);

	return (
		<Sprite
			x={ layer.offsetX ?? 0 }
			y={ layer.offsetY ?? 0 }
			scale={ 1 }
			texture={ texture }
			tint={ color }
			alpha={ alpha }
		/>
	);
}

function RoomDeviceGraphicsLayerSlot({ item, layer }: {
	item: ItemRoomDevice;
	layer: IRoomDeviceGraphicsLayerSlot;
}): ReactElement | null {
	const characterId = item.slotOccupancy.get(layer.slot);
	const chatRoom = useChatroomRequired();
	const chatroomCharacters = useChatRoomCharacters();
	const characterState = useCharacterState(chatRoom, characterId ?? null);

	if (!characterId)
		return null;

	const character = chatroomCharacters?.find((c) => c.id === characterId);

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
	layer: IRoomDeviceGraphicsLayerSlot;
	character: Character;
	characterState: AssetFrameworkCharacterState;
}): ReactElement | null {
	const evaluator = useAppearanceConditionEvaluator(characterState);

	const devicePivot = item.asset.definition.pivot;
	const x = devicePivot.x + layer.characterPosition.offsetX;
	const y = devicePivot.y + layer.characterPosition.offsetY;

	let baseScale = 1;
	if (evaluator.getBoneLikeValue('sitting') > 0) {
		baseScale *= 0.9;
	}

	const scale = baseScale * (layer.characterPosition.relativeScale ?? 1);

	const backView = useCharacterAppearanceView(characterState) === 'back';

	const scaleX = backView ? -1 : 1;

	const yOffsetPose = 0
		+ 1.75 * evaluator.getBoneLikeValue('kneeling')
		+ 0.75 * evaluator.getBoneLikeValue('sitting')
		+ (evaluator.getBoneLikeValue('kneeling') === 0 ? -0.2 : 0) * evaluator.getBoneLikeValue('tiptoeing');

	const yOffset = layer.characterPosition.disablePoseOffset ? 0 : yOffsetPose;

	// Character must be in this device, otherwise we skip rendering it here
	// (could happen if character left and rejoined the room without device equipped)
	const roomDeviceLink = useCharacterRestrictionsManager(characterState, character, (rm) => rm.getRoomDeviceLink());
	if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== layer.slot)
		return null;

	return (
		<GraphicsCharacter
			characterState={ characterState }
			position={ { x, y } }
			scale={ { x: scaleX * scale, y: scale } }
			pivot={ { x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT - yOffset } }
		>
		</GraphicsCharacter>
	);
}
