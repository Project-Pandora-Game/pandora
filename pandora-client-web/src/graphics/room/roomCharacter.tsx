import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Immutable } from 'immer';
import { throttle } from 'lodash';
import {
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	CharacterSize,
	ICharacterRoomData,
	LegsPose,
	RoomId,
	SpaceClientInfo,
} from 'pandora-common';
import PIXI, { DEG_TO_RAD, FederatedPointerEvent, Point, Rectangle, TextStyle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import disconnectedIcon from '../../assets/icons/disconnected.svg';
import { Character, useCharacterData } from '../../character/character';
import { useAsyncEvent, useEvent } from '../../common/useEvent';
import { useAccountSettings } from '../../components/gameContext/directoryConnectorContextProvider';
import { useCharacterRestrictionsManager } from '../../components/gameContext/gameStateContextProvider';
import { ShardConnector } from '../../networking/shardConnector';
import { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter, PointLike } from '../graphicsCharacter';
import { MASK_SIZE, SwapCullingDirection } from '../graphicsLayer';
import { useTexture } from '../useTexture';
import { useAppOptional } from '../utility';
import { RoomProjectionResolver, useCharacterDisplayFilters, usePlayerVisionFilters } from './roomScene';

type RoomCharacterInteractiveProps = {
	globalState: AssetFrameworkGlobalState;
	character: Character<ICharacterRoomData>;
	roomId: RoomId;
	spaceInfo: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	projectionResolver: Immutable<RoomProjectionResolver>;
	shard: ShardConnector | null;
	menuOpen: (target: Character<ICharacterRoomData>, data: FederatedPointerEvent) => void;
};

type RoomCharacterDisplayProps = {
	globalState: AssetFrameworkGlobalState;
	character: Character<ICharacterRoomData>;
	roomId: RoomId;
	projectionResolver: Immutable<RoomProjectionResolver>;

	debugConfig?: Immutable<ChatroomDebugConfig>;

	hitArea?: PIXI.Rectangle;
	cursor?: PIXI.Cursor;
	eventMode?: PIXI.EventMode;
	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
	onPointerMove?: (event: FederatedPointerEvent) => void;
};

type CharacterStateProps = {
	characterState: AssetFrameworkCharacterState;
};

const PIVOT_TO_LABEL_OFFSET = 100;
const CHARACTER_WAIT_DRAG_THRESHOLD = 400; // ms

export function useRoomCharacterOffsets(characterState: AssetFrameworkCharacterState): {
	/** Scale generated from pose */
	baseScale: number;
	/**
	 * Y offset based on pose and items.
	 * Affects pivot.
	 * Doesn't include manual offset.
	 */
	yOffset: number;
	/** Position of character's pivot (usually between feet; between knees when kneeling) */
	pivot: Readonly<PointLike>;
	/** Angle (in degrees) of whole-character rotation */
	rotationAngle: number;
} {
	const evaluator = useAppearanceConditionEvaluator(characterState);

	let baseScale = 1;
	if (evaluator.pose.legs === 'sitting') {
		baseScale *= 0.9;
	}

	const legEffectMap: Record<LegsPose, number> = {
		standing: 600,
		sitting: 0,
		kneeling: 300,
	};
	const legEffectCharacterOffsetBase = evaluator.pose.legs === 'sitting' ? 135 : legEffectMap.standing;
	const legEffect = legEffectMap[evaluator.pose.legs]
		+ (evaluator.pose.legs !== 'kneeling' ? 0.2 : 0) * evaluator.getBoneLikeValue('tiptoeing');

	const effectiveLegAngle = Math.min(Math.abs(evaluator.getBoneLikeValue('leg_l')), Math.abs(evaluator.getBoneLikeValue('leg_r')), 90);

	const yOffset = 0
		+ legEffectCharacterOffsetBase
		- legEffect * Math.cos(DEG_TO_RAD * effectiveLegAngle);

	const pivot = useMemo((): PointLike => ({ x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y - yOffset }), [yOffset]);

	return {
		baseScale,
		yOffset,
		pivot,
		rotationAngle: evaluator.getBoneLikeValue('character_rotation'),
	};
}

export function useRoomCharacterPosition(characterState: AssetFrameworkCharacterState, projectionResolver: Immutable<RoomProjectionResolver>): {
	/** Position on the room canvas */
	position: Readonly<PointLike>;
	/** Z index to use for the character within the room's container */
	zIndex: number;
	/**
	 * Y offset based on pose and items.
	 * Affects pivot.
	 * Doesn't include manual offset.
	 */
	yOffset: number;
	/**
	 * Y offset based on manual correction.
	 * Doesn't affect pivot.
	 */
	yOffsetExtra: number;
	/** Final scale of the character (both pose and room scaling applied) */
	scale: number;
	/** Position of character's pivot (usually between feet; between knees when kneeling) */
	pivot: Readonly<PointLike>;
	/** Angle (in degrees) of whole-character rotation */
	rotationAngle: number;
} {
	const [posX, posY, yOffsetExtra] = projectionResolver.fixupPosition(characterState.position.type === 'normal' ? characterState.position.position : [0, 0, 0]);

	const {
		baseScale,
		yOffset,
		pivot,
		rotationAngle,
	} = useRoomCharacterOffsets(characterState);

	return {
		position: useMemo((): PointLike => {
			const [x, y] = projectionResolver.transform(posX, posY, 0);
			return ({ x, y });
		}, [projectionResolver, posX, posY]),
		zIndex: -posY,
		yOffset,
		yOffsetExtra,
		scale: baseScale * projectionResolver.scaleAt(posX, posY, 0),
		pivot,
		rotationAngle,
	};
}

function RoomCharacterInteractiveImpl({
	globalState,
	character,
	roomId,
	characterState,
	spaceInfo,
	debugConfig,
	projectionResolver,
	shard,
	menuOpen,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const {
		yOffsetExtra,
		scale,
		pivot,
	} = useRoomCharacterPosition(characterState, projectionResolver);

	const [setPositionRaw] = useAsyncEvent(async (newX: number, newY: number, newYOffset: number) => {
		if (!shard || characterState.position.type !== 'normal') {
			return;
		}

		[newX, newY, newYOffset] = projectionResolver.fixupPosition([newX, newY, newYOffset]);

		await shard.awaitResponse('appearanceAction', {
			type: 'characterMove',
			target: characterState.id,
			position: {
				type: 'normal',
				roomId: characterState.position.roomId,
				position: [newX, newY, newYOffset],
			},
		});
	}, () => {
		/* Do nothing */
	});

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, 100), [setPositionRaw]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitArea = useMemo(() => new Rectangle(labelX - 100, labelY - 50, 200, 100), [labelX, labelY]);

	const characterContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((event: FederatedPointerEvent) => {
		if (dragging.current || !characterContainer.current) return;
		dragging.current = event.getLocalPosition<Point>(characterContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: FederatedPointerEvent) => {
		if (!dragging.current || !spaceInfo || !characterContainer.current) return;
		const dragPointerEnd = event.getLocalPosition<Point>(characterContainer.current.parent);

		const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, (dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale), 0);

		setPositionThrottled(newX, newY, yOffsetExtra);
	});

	const onPointerDown = useCallback((event: FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((event: FederatedPointerEvent) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			menuOpen(character, event);
		}
		pointerDown.current = null;
	});

	const onPointerMove = useCallback((event: FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (pointerDown.current !== null && Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	return (
		<RoomCharacterDisplay
			ref={ characterContainer }
			globalState={ globalState }
			character={ character }
			roomId={ roomId }
			characterState={ characterState }
			projectionResolver={ projectionResolver }
			debugConfig={ debugConfig }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
			onPointerMove={ onPointerMove }
		/>
	);
}

const RoomCharacterDisplay = React.forwardRef(function RoomCharacterDisplay({
	character,
	characterState,
	projectionResolver,
	debugConfig,

	eventMode,
	cursor,
	hitArea,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}: RoomCharacterDisplayProps & CharacterStateProps, ref?: React.ForwardedRef<PIXI.Container>): ReactElement | null {
	const app = useAppOptional();

	const {
		name,
		settings,
		isOnline,
	} = useCharacterData(character);

	const { interfaceChatroomOfflineCharacterFilter } = useAccountSettings();

	const playerFilters = usePlayerVisionFilters(character.isPlayer());
	const characterFilters = useCharacterDisplayFilters(character);
	const filters = useMemo(() => [...playerFilters, ...characterFilters], [playerFilters, characterFilters]);

	const {
		position,
		zIndex,
		yOffsetExtra,
		scale,
		pivot,
		rotationAngle,
	} = useRoomCharacterPosition(characterState, projectionResolver);

	const backView = characterState.actualPose.view === 'back';

	const scaleX = backView ? -1 : 1;

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const showDisconnectedIcon = !isOnline && interfaceChatroomOfflineCharacterFilter === 'icon';
	const disconnectedIconTexture = useTexture(disconnectedIcon);
	const disconnectedIconY = labelY + 50;

	useEffect(() => {
		if (app == null || onPointerMove == null)
			return;
		// TODO: Move to globalpointermove once @pixi/react supports them
		app.stage.eventMode = 'static';
		app.stage.on('pointermove', onPointerMove);
		return () => {
			app.stage?.off('pointermove', onPointerMove);
		};
	}, [app, onPointerMove]);

	// Debug graphics
	const hotboxDebugDraw = useCallback((g: PIXI.Graphics) => {
		if (hitArea == null) {
			g.clear();
			return;
		}

		g.clear()
			.beginFill(0xff0000, 0.25)
			.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
	}, [hitArea]);

	// If character is in a device, do not render it here, it will be rendered by the device
	const roomDeviceLink = useCharacterRestrictionsManager(characterState, character, (rm) => rm.getRoomDeviceLink());

	if (roomDeviceLink != null)
		return null;

	return (
		<Container
			ref={ ref }
			position={ position }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
			zIndex={ zIndex }
			filters={ filters }
			sortableChildren
			eventMode={ eventMode ?? 'auto' }
			cursor={ cursor ?? 'default' }
			hitArea={ hitArea ?? null }
			pointerdown={ onPointerDown }
			pointerup={ onPointerUp }
			pointerupoutside={ onPointerUp }
			pointermove={ onPointerMove }
		>
			<SwapCullingDirection uniqueKey='filter' swap={ filters.length > 0 }>
				<GraphicsCharacter
					characterState={ characterState }
					position={ { x: pivot.x, y: pivot.y - yOffsetExtra } }
					scale={ { x: scaleX, y: 1 } }
					pivot={ pivot }
					angle={ rotationAngle }
				>
					{
						!debugConfig?.characterDebugOverlay ? null : (
							<Container
								zIndex={ 99999 }
							>
								<Graphics
									draw={ (g) => {
										g.clear()
											// Pivot point (with extra Y offset)
											.beginFill(0xffaa00)
											.lineStyle({ color: 0x000000, width: 1 })
											.drawCircle(pivot.x, pivot.y, 5)
											.endFill()
											// Mask area
											.lineStyle({ color: 0xffff00, width: 2 })
											.drawRect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
											// Character canvas standard area
											.lineStyle({ color: 0x00ff00, width: 2 })
											.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
									} }
								/>
							</Container>
						)
					}
				</GraphicsCharacter>
				<Text
					anchor={ { x: 0.5, y: 0.5 } }
					position={ { x: labelX, y: labelY } }
					style={ new TextStyle({
						fontFamily: 'Arial',
						fontSize: 32,
						fill: settings.labelColor,
						align: 'center',
						dropShadow: true,
						dropShadowBlur: 4,
					}) }
					text={ name }
				/>
				{
						!showDisconnectedIcon ? null : (
							<Sprite
								anchor={ { x: 0.5, y: 0.5 } }
								texture={ disconnectedIconTexture }
								position={ { x: labelX, y: disconnectedIconY } }
								width={ 64 }
								height={ 64 }
							/>
						)
				}
				{
					!debugConfig?.characterDebugOverlay ? null : (
						<Container
							zIndex={ 99999 }
						>
							<Graphics
								draw={ (g) => {
									g.clear()
										// Pivot point (wanted)
										.beginFill(0xffff00)
										.lineStyle({ color: 0x000000, width: 1 })
										.drawCircle(pivot.x, pivot.y, 5);
								} }
							/>
							<Graphics draw={ hotboxDebugDraw } />
						</Container>
					)
				}
			</SwapCullingDirection>
		</Container>
	);
});

export function RoomCharacterInteractive({
	globalState,
	character,
	roomId,
	...props
}: RoomCharacterInteractiveProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	// Do not render characters we don't have data for or that are in other rooms
	if (!characterState || characterState.position.type !== 'normal' || characterState.position.roomId !== roomId)
		return null;

	return (
		<RoomCharacterInteractiveImpl
			{ ...props }
			globalState={ globalState }
			character={ character }
			roomId={ roomId }
			characterState={ characterState }
		/>
	);
}

export function RoomCharacter({
	globalState,
	character,
	roomId,
	...props
}: RoomCharacterDisplayProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	// Do not render characters we don't have data for or that are in other rooms
	if (!characterState || characterState.position.type !== 'normal' || characterState.position.roomId !== roomId)
		return null;

	return (
		<RoomCharacterDisplay
			{ ...props }
			globalState={ globalState }
			character={ character }
			roomId={ roomId }
			characterState={ characterState }
		/>
	);
}
