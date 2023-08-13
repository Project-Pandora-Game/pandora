import { AssetFrameworkCharacterState, CalculateCharacterMaxYForBackground, CharacterSize, ICharacterRoomData, IChatroomBackgroundData, IChatRoomFullInfo, LegsPose } from 'pandora-common';
import PIXI, { DEG_TO_RAD, FederatedPointerEvent, Point, Rectangle, TextStyle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { Character, useCharacterAppearanceView, useCharacterData } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import _ from 'lodash';
import { ChatroomDebugConfig } from './chatroomDebug';
import { CHARACTER_BASE_Y_OFFSET, CHARACTER_PIVOT_POSITION, GraphicsCharacter, PointLike } from '../../graphics/graphicsCharacter';
import { Container, Graphics, Sprite, Text, useApp } from '@pixi/react';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { useEvent } from '../../common/useEvent';
import { MASK_SIZE } from '../../graphics/graphicsLayer';
import { ChatRoom, useCharacterRestrictionsManager, useCharacterState } from '../gameContext/chatRoomContextProvider';
import { useCharacterDisplayFilters, usePlayerVisionFilters } from './chatRoomScene';
import { useCurrentAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { useTexture } from '../../graphics/useTexture';
import disconnectedIcon from '../../assets/icons/disconnected.svg';

type ChatRoomCharacterProps = {
	character: Character<ICharacterRoomData>;
	room: ChatRoom;
	roomInfo: IChatRoomFullInfo | null;
	debugConfig: ChatroomDebugConfig;
	background: IChatroomBackgroundData;
	shard: ShardConnector | null;
	menuOpen: (target: Character<ICharacterRoomData>, data: FederatedPointerEvent) => void;
};

type ChatRoomCharacterPropsWithState = ChatRoomCharacterProps & {
	characterState: AssetFrameworkCharacterState;
};

const PIVOT_TO_LABEL_OFFSET = 100 - CHARACTER_BASE_Y_OFFSET;
const CHARACTER_WAIT_DRAG_THRESHOLD = 400; // ms

export function useChatRoomCharacterOffsets(characterState: AssetFrameworkCharacterState): {
	baseScale: number;
	yOffset: number;
	pivot: Readonly<PointLike>;
	/**
	 * This pivot is adjusted for the error in the room positioning
	 * @see CHARACTER_BASE_Y_OFFSET
	 */
	errorCorrectedPivot: Readonly<PointLike>;
} {
	const evaluator = useAppearanceConditionEvaluator(characterState);

	let baseScale = 1;
	if (evaluator.legs === 'sitting') {
		baseScale *= 0.9;
	}

	const legEffectMap: Record<LegsPose, number> = {
		standing: 600,
		sitting: 0,
		kneeling: 300,
	};
	const legEffectCharacterOffsetBase = evaluator.legs === 'sitting' ? 135 : legEffectMap.standing;
	const legEffect = legEffectMap[evaluator.legs]
		+ (evaluator.getBoneLikeValue('kneeling') === 0 ? 0.2 : 0) * evaluator.getBoneLikeValue('tiptoeing');

	const effectiveLegAngle = Math.min(Math.abs(evaluator.getBoneLikeValue('leg_l')), Math.abs(evaluator.getBoneLikeValue('leg_r')), 90);

	const yOffset = 0
		+ legEffectCharacterOffsetBase
		- legEffect * Math.cos(DEG_TO_RAD * effectiveLegAngle);

	const pivot = useMemo((): PointLike => ({ x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y - yOffset }), [yOffset]);
	const errorCorrectedPivot = useMemo((): PointLike => ({ x: pivot.x, y: pivot.y + CHARACTER_BASE_Y_OFFSET }), [pivot]);

	return {
		baseScale,
		yOffset,
		pivot,
		errorCorrectedPivot,
	};
}

export function useChatRoomCharacterPosition(
	position: readonly [number, number],
	characterState: AssetFrameworkCharacterState,
	background: IChatroomBackgroundData,
): {
		position: Readonly<PointLike>;
		rawPositionY: number;
		yOffset: number;
		scale: number;
		pivot: Readonly<PointLike>;
		/**
	 * This pivot is adjusted for the error in the room positioning
	 * @see CHARACTER_BASE_Y_OFFSET
	 */
		errorCorrectedPivot: Readonly<PointLike>;
	} {
	const [width, height] = background.size;
	const scaling = background.scaling;

	const x = Math.min(width, position[0]);
	const y = Math.min(height, position[1]);

	const { baseScale, yOffset, pivot, errorCorrectedPivot } = useChatRoomCharacterOffsets(characterState);

	const scale = baseScale * (1 - (y * scaling) / height);

	return {
		position: useMemo((): PointLike => ({ x, y: height - y }), [x, y, height]),
		rawPositionY: y,
		yOffset,
		scale,
		pivot,
		errorCorrectedPivot,
	};
}

function ChatRoomCharacterDisplay({
	character,
	characterState,
	roomInfo,
	debugConfig,
	background,
	shard,
	menuOpen,
}: ChatRoomCharacterPropsWithState): ReactElement | null {
	const app = useApp();

	const {
		id,
		name,
		position: dataPosition,
		settings,
		isOnline,
	} = useCharacterData(character);

	const { interfaceChatroomOfflineCharacterFilter } = useCurrentAccountSettings();

	const playerFilters = usePlayerVisionFilters(character.isPlayer());
	const characterFilters = useCharacterDisplayFilters(character);
	const filters = useMemo(() => [...playerFilters, ...characterFilters], [playerFilters, characterFilters]);

	const setPositionRaw = useEvent((newX: number, newY: number): void => {
		const maxY = CalculateCharacterMaxYForBackground(background);

		newX = _.clamp(Math.round(newX), 0, background.size[0]);
		newY = _.clamp(Math.round(newY), 0, maxY);
		shard?.sendMessage('chatRoomCharacterMove', {
			id,
			position: [newX, newY],
		});
	});

	const setPositionThrottled = useMemo(() => _.throttle(setPositionRaw, 100), [setPositionRaw]);

	const height = background.size[1];
	const { position, rawPositionY, scale, pivot, errorCorrectedPivot } = useChatRoomCharacterPosition(dataPosition, characterState, background);

	const backView = useCharacterAppearanceView(characterState) === 'back';

	const scaleX = backView ? -1 : 1;

	const labelX = errorCorrectedPivot.x;
	const labelY = errorCorrectedPivot.y + PIVOT_TO_LABEL_OFFSET;

	const showDisconnectedIcon = !isOnline && interfaceChatroomOfflineCharacterFilter === 'icon';
	const disconnectedIconTexture = useTexture(disconnectedIcon);
	const disconnectedIconY = labelY + 50;

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
		if (!dragging.current || !roomInfo || !characterContainer.current) return;
		const dragPointerEnd = event.getLocalPosition<Point>(characterContainer.current.parent);

		const newY = height - (dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale);

		setPositionThrottled(dragPointerEnd.x, newY);
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

	useEffect(() => {
		// TODO: Move to globalpointermove once @pixi/react supports them
		app.stage.eventMode = 'static';
		app.stage.on('pointermove', onPointerMove);
		return () => {
			app.stage?.off('pointermove', onPointerMove);
		};
	}, [app, onPointerMove]);

	// Debug graphics
	const hotboxDebugDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.beginFill(0xff0000, 0.25)
			.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
	}, [hitArea]);

	// If character is in a device, do not render it here, it will be rendered by the device
	const roomDeviceLink = useCharacterRestrictionsManager(characterState, character, (rm) => rm.getRoomDeviceLink());

	if (roomDeviceLink != null)
		return null;

	return (
		<GraphicsCharacter
			ref={ characterContainer }
			characterState={ characterState }
			position={ position }
			scale={ { x: scaleX * scale, y: scale } }
			pivot={ errorCorrectedPivot }
			hitArea={ hitArea }
			eventMode='static'
			filters={ filters }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
			onPointerUpOutside={ onPointerUp }
			zIndex={ -rawPositionY }
		>
			<Text
				anchor={ { x: 0.5, y: 0.5 } }
				position={ { x: labelX, y: labelY } }
				scale={ { x: 1 / scaleX, y: 1 } }
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
									// Mask area
									.lineStyle({ color: 0xffff00, width: 2 })
									.drawRect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
									// Character canvas standard area
									.lineStyle({ color: 0x00ff00, width: 2 })
									.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
									// Pivot point (wanted)
									.beginFill(0xffff00)
									.lineStyle({ color: 0x000000, width: 1 })
									.drawCircle(pivot.x, pivot.y, 5)
									// Pivot point (actual)
									.beginFill(0xccff00)
									.lineStyle({ color: 0x000000, width: 1 })
									.drawCircle(errorCorrectedPivot.x, errorCorrectedPivot.y, 5);
							} }
						/>
						<Graphics draw={ hotboxDebugDraw } />
					</Container>
				)
			}
		</GraphicsCharacter>
	);
}

export function ChatRoomCharacter({
	room,
	character,
	...props
}: ChatRoomCharacterProps): ReactElement | null {
	const characterState = useCharacterState(room, character.id);

	if (!characterState)
		return null;

	return (
		<ChatRoomCharacterDisplay
			{ ...props }
			room={ room }
			character={ character }
			characterState={ characterState }
		/>
	);
}
