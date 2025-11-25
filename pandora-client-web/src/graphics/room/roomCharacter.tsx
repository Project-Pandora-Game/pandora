import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	CHARACTER_SETTINGS_DEFAULT,
	CharacterSize,
	ICharacterRoomData,
	LegsPose,
	SpaceClientInfo,
	type RoomProjectionResolver,
} from 'pandora-common';
import { CanvasTextMetrics, DEG_TO_RAD, FederatedPointerEvent, GraphicsContext, Point, Rectangle, TextStyle, type Cursor, type EventMode, type Filter } from 'pixi.js';
import { memo, ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import disconnectedIcon from '../../assets/icons/disconnected.svg';
import statusIconAway from '../../assets/icons/state-away.svg';
import { Character, useCharacterData } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useFetchedResourceText } from '../../common/useFetch.ts';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { THEME_FONT } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_ERROR_THROTTLE, LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { SettingDisplayCharacterName } from '../../ui/screens/room/roomState.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, type CharacterPoseEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { Text } from '../baseComponents/text.ts';
import { PointLike } from '../common/point.ts';
import { TransitionedContainer } from '../common/transitions/transitionedContainer.ts';
import { useCharacterDisplayFilters, useCharacterDisplayStyle } from '../common/visionFilters.tsx';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MASK_SIZE } from '../layers/graphicsLayerAlphaImageMesh.tsx';
import type { PixiPointLike } from '../reconciler/component.ts';
import { useTickerRef } from '../reconciler/tick.ts';
import { CalculateCharacterDeviceSlotPosition } from './roomDevice.tsx';

export type RoomCharacterInteractiveProps = {
	characterState: AssetFrameworkCharacterState;
	character: Character<ICharacterRoomData>;
	spaceInfo: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	projectionResolver: RoomProjectionResolver;
	visionFilters: () => readonly Filter[];
};

type RoomCharacterDisplayProps = {
	characterState: AssetFrameworkCharacterState;
	character: Character<ICharacterRoomData>;
	projectionResolver: RoomProjectionResolver;
	visionFilters: () => readonly Filter[];
	showName: boolean;

	debugConfig?: Immutable<ChatroomDebugConfig>;

	quickTransitions?: boolean;
	hitArea?: Rectangle;
	cursor?: Cursor;
	eventMode?: EventMode;
	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
	onPointerMove?: (event: FederatedPointerEvent) => void;
};

export const PIVOT_TO_LABEL_OFFSET = 100;
export const CHARACTER_WAIT_DRAG_THRESHOLD = 400; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL = 250; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION = LIVE_UPDATE_THROTTLE; // ms

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
	/** Appearance condition evaluator for the character */
	evaluator: CharacterPoseEvaluator;
} {
	const evaluator = useCharacterPoseEvaluator(characterState.assetManager, characterState.actualPose);

	let baseScale = 1;
	if (evaluator.pose.legs.pose === 'sitting') {
		baseScale *= 0.9;
	}

	const legEffectMap: Record<LegsPose, number> = {
		standing: 600,
		sitting: 0,
		kneeling: 242,
	};
	const legEffectCharacterOffsetBase = evaluator.pose.legs.pose === 'sitting' ? 135 : legEffectMap.standing;
	const legEffect = legEffectMap[evaluator.pose.legs.pose]
		+ (evaluator.pose.legs.pose !== 'kneeling' ? 0.11 : 0) * evaluator.getBoneLikeValue('tiptoeing');

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
		evaluator,
	};
}

export type RoomCharacterCalculatedPosition = {
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
};

export function useRoomCharacterPosition(characterState: AssetFrameworkCharacterState, projectionResolver: RoomProjectionResolver): RoomCharacterCalculatedPosition {
	const [posX, posY, yOffsetExtra] = projectionResolver.fixupPosition(characterState.position.position);

	const {
		baseScale,
		yOffset,
		pivot,
		rotationAngle,
	} = useRoomCharacterOffsets(characterState);

	const poseEvaluator = useCharacterPoseEvaluator(characterState.assetManager, characterState.actualPose);
	const evaluator = useAppearanceConditionEvaluator(poseEvaluator, characterState.items);

	const graphicsManager = useObservable(GraphicsManagerInstance);

	return useMemo((): RoomCharacterCalculatedPosition => {
		// If we are in a room device, calculate transformation based on it instead
		const roomDeviceWearablePart = characterState.getRoomDeviceWearablePart();
		if (roomDeviceWearablePart != null) {
			do {
				const roomDevice = roomDeviceWearablePart.roomDevice;
				if (roomDevice == null)
					break;

				const deviceGraphics = graphicsManager?.assetGraphics[roomDevice.asset.id];
				if (deviceGraphics?.type !== 'roomDevice')
					break;

				const displayLayer = deviceGraphics.layers.findLast((layer) => layer.type === 'slot' && layer.slot === roomDeviceWearablePart.roomDeviceLink?.slot);
				if (displayLayer?.type !== 'slot' || roomDevice?.deployment == null)
					break;

				const [deploymentX, deploymentY, deploymentYOffsetExtra] = projectionResolver.fixupPosition([
					roomDevice.deployment.x,
					roomDevice.deployment.y,
					roomDevice.deployment.yOffset,
				]);
				const [deviceX, deviceBaseY] = projectionResolver.transform(deploymentX, deploymentY, 0);
				const deviceScale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
				const deviceY = deviceBaseY - deploymentYOffsetExtra;
				const devicePivot = roomDevice.asset.definition.pivot;

				const {
					position: slotPosition,
					pivot: slotPivot,
					scale: slotScale,
				} = CalculateCharacterDeviceSlotPosition({
					item: roomDevice,
					layer: displayLayer,
					characterState,
					evaluator,
					baseScale,
					pivot,
				});

				return {
					position: {
						x: deviceX + deviceScale * (-devicePivot.x + slotPosition.x),
						y: deviceY + deviceScale * (-devicePivot.y + slotPosition.y),
					},
					zIndex: 0,
					yOffset: 0,
					yOffsetExtra: 0,
					scale: deviceScale * slotScale.y,
					pivot: slotPivot,
					rotationAngle,
				};
			// eslint-disable-next-line no-constant-condition
			} while (false);
		}

		// Normal character room position
		{
			const [x, y] = projectionResolver.transform(posX, posY, 0);
			return {
				position: { x, y },
				zIndex: -posY,
				yOffset,
				yOffsetExtra,
				scale: baseScale * projectionResolver.scaleAt(posX, posY, 0),
				pivot,
				rotationAngle,
			};
		}
	}, [baseScale, characterState, evaluator, pivot, posX, posY, projectionResolver, rotationAngle, yOffset, yOffsetExtra, graphicsManager]);
}

export const RoomCharacterInteractive = memo(function RoomCharacterInteractive({
	character,
	characterState,
	spaceInfo,
	debugConfig,
	projectionResolver,
	visionFilters,
}: RoomCharacterInteractiveProps): ReactElement | null {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });
	const id = characterState.id;

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

	const {
		yOffsetExtra,
		scale,
	} = useRoomCharacterPosition(characterState, projectionResolver);

	const disableManualMove = characterState.position.following != null && characterState.position.following.followType !== 'leash';

	const setPositionErrorCooldown = useRef<number>(null);
	const setPositionRaw = useEvent((newX: number, newY: number) => {
		if (disableManualMove) {
			if (setPositionErrorCooldown.current != null && setPositionErrorCooldown.current >= Date.now()) {
				// Silent error because recently same one happened
			} else {
				setPositionErrorCooldown.current = Date.now() + LIVE_UPDATE_ERROR_THROTTLE;
				toast('Character that is following another character cannot be moved manually.', TOAST_OPTIONS_WARNING);
			}
			return;
		}

		execute({
			type: 'moveCharacter',
			target: {
				type: 'character',
				characterId: id,
			},
			moveTo: {
				type: 'normal',
				room: characterState.currentRoom,
				position: projectionResolver.fixupPosition([newX, newY, yOffsetExtra]),
				following: characterState.position.following,
			},
		});
	});

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const labelX = 0;
	const labelY = PIVOT_TO_LABEL_OFFSET;

	const hitArea = useMemo(() => new Rectangle(labelX - 100, labelY - 50, 200, 100), [labelX, labelY]);

	const dragging = useRef<Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((event: FederatedPointerEvent) => {
		if (dragging.current || !event.currentTarget.parent)
			return;
		dragging.current = event.getLocalPosition<Point>(event.currentTarget.parent);
	}, []);

	const onDragMove = useEvent((event: FederatedPointerEvent) => {
		if (!dragging.current || !spaceInfo || !event.currentTarget.parent)
			return;
		const dragPointerEnd = event.getLocalPosition<Point>(event.currentTarget.parent);

		const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, (dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale), 0);

		setPositionThrottled(newX, newY);
	});

	const onPointerDown = useCallback((event: FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			pointerDown.current = Date.now();
		}
	}, []);

	const onPointerUp = useEvent((event: FederatedPointerEvent) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			openContextMenu({
				type: 'character',
				character,
			}, {
				x: event.pageX,
				y: event.pageY,
			});
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

	const isFocused = (roomSceneMode.mode === 'moveCharacter' || roomSceneMode.mode === 'poseCharacter') && roomSceneMode.characterId === character.id;
	const enableMenu = !isFocused;

	return (
		<RoomCharacter
			character={ character }
			characterState={ characterState }
			projectionResolver={ projectionResolver }
			visionFilters={ visionFilters }
			debugConfig={ debugConfig }
			showName={ enableMenu }
			quickTransitions={ isFocused }
			cursor={ enableMenu ? 'pointer' : 'none' }
			eventMode={ enableMenu ? 'static' : 'none' }
			hitArea={ hitArea }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
			onPointerMove={ onPointerMove }
		/>
	);
});

export const RoomCharacter = memo(function RoomCharacter({
	character,
	characterState,
	projectionResolver,
	visionFilters,
	showName,
	debugConfig,

	quickTransitions = false,
	eventMode,
	cursor,
	hitArea,
	onPointerDown: onPointerDownOuter,
	onPointerMove,
	onPointerUp: onPointerUpOuter,
}: RoomCharacterDisplayProps): ReactElement | null {
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const characterDisplayStyle = useCharacterDisplayStyle(character);
	const characterFilters = useCharacterDisplayFilters(characterDisplayStyle);
	const filters = useMemo(() => [...visionFilters(), ...characterFilters], [visionFilters, characterFilters]);

	const [held, setHeld] = useState(false);
	const [hover, setHover] = useState(false);

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

	const labelX = 0;
	const labelY = PIVOT_TO_LABEL_OFFSET;

	showName = useObservable(SettingDisplayCharacterName) && showName;

	// If character is in a device, do not render it here, it will be rendered by the device
	const roomDeviceLink = characterState.getRoomDeviceWearablePart()?.roomDeviceLink;

	const transitionTickerRef = useTickerRef();
	const movementTransitionDuration = !smoothMovementEnabled ? 0 :
		quickTransitions ? CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION :
		CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL;

	const onPointerDown = useCallback((event: FederatedPointerEvent) => {
		setHeld(true);
		onPointerDownOuter?.(event);
	}, [onPointerDownOuter]);

	const onPointerUp = useCallback((event: FederatedPointerEvent) => {
		setHeld(false);
		onPointerUpOuter?.(event);
	}, [onPointerUpOuter]);

	const onPointerEnter = useCallback((_event: FederatedPointerEvent) => {
		setHover(true);
	}, []);

	const onPointerLeave = useCallback((_event: FederatedPointerEvent) => {
		setHover(false);
	}, []);

	const innerPosition = useMemo((): PointLike => ({ x: 0, y: -yOffsetExtra }), [yOffsetExtra]);
	const innerScale = useMemo((): PointLike => ({ x: scaleX, y: 1 }), [scaleX]);

	if (roomDeviceLink != null || characterDisplayStyle === 'hidden')
		return null;

	return (
		<TransitionedContainer
			position={ position }
			scale={ scale }
			zIndex={ zIndex }
			eventMode={ eventMode ?? 'auto' }
			cursor={ cursor ?? 'default' }
			hitArea={ hitArea ?? null }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
			onglobalpointermove={ onPointerMove }
			onpointerenter={ onPointerEnter }
			onpointerleave={ onPointerLeave }
			transitionDuration={ movementTransitionDuration }
			tickerRef={ transitionTickerRef }
		>
			{ characterDisplayStyle !== 'name-only' ? (
				<GraphicsCharacter
					characterState={ characterState }
					position={ innerPosition }
					scale={ innerScale }
					pivot={ pivot }
					angle={ rotationAngle }
					filters={ filters }
					useBlinking
					movementTransitionDuration={ movementTransitionDuration }
					debugConfig={ debugConfig }
				>
					{
						!debugConfig?.characterDebugOverlay ? null : (
							<Container zIndex={ 99999 }>
								<RoomCharacterDebugGraphicsInner pivot={ pivot } />
							</Container>
						)
					}
				</GraphicsCharacter>
			) : null }
			{ showName ? (
				<RoomCharacterLabel
					position={ { x: labelX, y: labelY } }
					character={ character }
					theme={ held ? 'active' : hover ? 'hover' : 'normal' }
				/>
			) : null }
			{ !debugConfig?.characterDebugOverlay ? null : (
				<Container>
					<RoomCharacterDebugGraphicsOuter pivot={ pivot } hitArea={ hitArea } />
				</Container>
			) }
		</TransitionedContainer>
	);
});

export function RoomCharacterLabel({ position, character, theme }: {
	position?: PixiPointLike;
	character: Character<ICharacterRoomData>;
	theme: 'normal' | 'hover' | 'active';
}): ReactElement {
	const {
		name,
		publicSettings: { labelColor },
		onlineStatus,
	} = useCharacterData(character);

	const {
		interfaceChatroomCharacterAwayStatusIconDisplay,
		interfaceChatroomOfflineCharacterFilter,
		interfaceChatroomCharacterNameFontSize,
		interfaceAccentColor,
	} = useAccountSettings();

	const showAwayIcon = onlineStatus === 'away' && interfaceChatroomCharacterAwayStatusIconDisplay;
	const awayIconTexture = useFetchedResourceText(statusIconAway);
	const drawAwayIcon = useCallback((g: GraphicsContext) => {
		g.clear();
		if (awayIconTexture) {
			g.svg(awayIconTexture);
		}
	}, [awayIconTexture]);

	const showDisconnectedIcon = onlineStatus === 'offline' && interfaceChatroomOfflineCharacterFilter === 'icon';
	const disconnectedIconTexture = useFetchedResourceText(disconnectedIcon);
	const drawDisconnectedIcon = useCallback((g: GraphicsContext) => {
		g.clear();
		if (disconnectedIconTexture) {
			g.svg(disconnectedIconTexture);
		}
	}, [disconnectedIconTexture]);

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

	const style = useMemo(() => new TextStyle({
		fontFamily: THEME_FONT.slice(),
		fontSize: 32 * fontScale,
		fill: labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor,
		align: 'center',
		dropShadow: { blur: 4 },
		stroke: {
			color: new Color('#222222').mixSrgb(new Color(interfaceAccentColor), theme === 'active' ? 0.65 : 0.35).toHex(),
			width: (
				theme === 'active' || theme === 'hover' ? 6 :
				theme === 'normal' ? 0 :
				AssertNever(theme)
			),
		},
	}), [fontScale, interfaceAccentColor, labelColor, theme]);

	const nameMeasure = useMemo(() => CanvasTextMetrics.measureText(name, style), [name, style]);

	return (
		<Container
			position={ position }
		>
			<Text
				anchor={ { x: 0.5, y: 0.5 } }
				style={ style }
				text={ name }
			/>
			{ !showAwayIcon ? null : (
				<Graphics
					draw={ drawAwayIcon }
					position={ {
						x: - 32 * 1.3 * fontScale - nameMeasure.maxLineWidth / 2,
						y: - 32 * 0.5 * fontScale,
					} }
					scale={ (32 / 50) * fontScale }
				/>
			) }
			{ !showDisconnectedIcon ? null : (
				<Graphics
					draw={ drawDisconnectedIcon }
					position={ {
						x: + 2 * fontScale + nameMeasure.maxLineWidth / 2,
						y: - 56 * 0.5 * fontScale,
					} }
					scale={ (56 / 600) * fontScale }
				/>
			) }
		</Container>
	);
}

function RoomCharacterDebugGraphicsInner({ pivot }: {
	pivot: Readonly<PointLike>;
}): ReactElement {
	const pivotDraw = useCallback((g: GraphicsContext) => {
		g
			// Pivot point (with extra Y offset)
			.circle(pivot.x, pivot.y, 5)
			.fill(0xffaa00)
			.stroke({ color: 0x000000, width: 1 })
			// Mask area
			.rect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
			.stroke({ color: 0xffff00, width: 1, pixelLine: true })
			// Character canvas standard area
			.rect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
			.stroke({ color: 0x00ff00, width: 1, pixelLine: true });
	}, [pivot]);

	return (
		<Graphics
			draw={ pivotDraw }
		/>
	);
}

function RoomCharacterDebugGraphicsOuter({ pivot, hitArea }: {
	pivot: Readonly<PointLike>;
	hitArea?: Rectangle;
}): ReactElement {
	const pivotDraw = useCallback((g: GraphicsContext) => {
		g
			// Pivot point (wanted)
			.circle(pivot.x, pivot.y, 5)
			.fill(0xffff00)
			.stroke({ color: 0x000000, width: 1 });
	}, [pivot]);

	const hitboxDebugDraw = useCallback((g: GraphicsContext) => {
		if (hitArea == null) {
			return;
		}

		g
			.rect(hitArea.x, hitArea.y, hitArea.width, hitArea.height)
			.fill({ color: 0xff0000, alpha: 0.25 });
	}, [hitArea]);

	return (
		<>
			<Graphics draw={ pivotDraw } />
			<Graphics draw={ hitboxDebugDraw } />
		</>
	);
}
