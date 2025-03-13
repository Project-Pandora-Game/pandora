import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	CharacterRoomPosition,
	CharacterSize,
	ICharacterRoomData,
	LegsPose,
	SpaceClientInfo,
} from 'pandora-common';
import { DEG_TO_RAD, FederatedPointerEvent, Point, Rectangle, TextStyle, type Cursor, type EventMode, type GraphicsContext } from 'pixi.js';
import { ReactElement, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import disconnectedIcon from '../../assets/icons/disconnected.svg';
import { BrowserStorage } from '../../browserStorage.ts';
import { Character, useCharacterData } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useCharacterRestrictionsManager } from '../../components/gameContext/gameStateContextProvider.tsx';
import { THEME_FONT } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { ShardConnector } from '../../networking/shardConnector.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { useAppearanceConditionEvaluator, type AppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { Sprite } from '../baseComponents/sprite.ts';
import { Text } from '../baseComponents/text.ts';
import { TransitionedContainer } from '../common/transitions/transitionedContainer.ts';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter, PointLike } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MASK_SIZE } from '../layers/graphicsLayerAlphaImageMesh.tsx';
import { SwapCullingDirection } from '../layers/graphicsLayerCommon.tsx';
import { useTickerRef } from '../reconciler/tick.ts';
import { useTexture } from '../useTexture.ts';
import { CalculateCharacterDeviceSlotPosition } from './roomDevice.tsx';
import { RoomProjectionResolver, useCharacterDisplayFilters, usePlayerVisionFilters } from './roomScene.tsx';

export type RoomCharacterInteractiveProps = {
	globalState: AssetFrameworkGlobalState;
	character: Character<ICharacterRoomData>;
	spaceInfo: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	projectionResolver: Immutable<RoomProjectionResolver>;
	shard: ShardConnector | null;
};

type RoomCharacterDisplayProps = {
	globalState: AssetFrameworkGlobalState;
	character: Character<ICharacterRoomData>;
	projectionResolver: Immutable<RoomProjectionResolver>;
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

export type CharacterStateProps = {
	characterState: AssetFrameworkCharacterState;
};

export const PIVOT_TO_LABEL_OFFSET = 100;
export const CHARACTER_WAIT_DRAG_THRESHOLD = 400; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL = 250; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION = LIVE_UPDATE_THROTTLE; // ms

export const SettingDisplayCharacterName = BrowserStorage.createSession('graphics.display-character-name', true, z.boolean());

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
	evaluator: AppearanceConditionEvaluator;
} {
	const evaluator = useAppearanceConditionEvaluator(characterState);

	let baseScale = 1;
	if (evaluator.pose.legs === 'sitting') {
		baseScale *= 0.9;
	}

	const legEffectMap: Record<LegsPose, number> = {
		standing: 600,
		sitting: 0,
		kneeling: 242,
	};
	const legEffectCharacterOffsetBase = evaluator.pose.legs === 'sitting' ? 135 : legEffectMap.standing;
	const legEffect = legEffectMap[evaluator.pose.legs]
		+ (evaluator.pose.legs !== 'kneeling' ? 0.11 : 0) * evaluator.getBoneLikeValue('tiptoeing');

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

export function useRoomCharacterPosition(position: CharacterRoomPosition, characterState: AssetFrameworkCharacterState, projectionResolver: Immutable<RoomProjectionResolver>): RoomCharacterCalculatedPosition {
	const [posX, posY, yOffsetExtra] = projectionResolver.fixupPosition(position);

	const {
		baseScale,
		yOffset,
		pivot,
		rotationAngle,
		evaluator,
	} = useRoomCharacterOffsets(characterState);

	return useMemo((): RoomCharacterCalculatedPosition => {
		// If we are in a room device, calculate transformation based on it instead
		const roomDeviceWearablePart = characterState.getRoomDeviceWearablePart();
		if (roomDeviceWearablePart != null) {
			const roomDevice = roomDeviceWearablePart.roomDevice;
			const deviceAsset = roomDevice?.asset.definition;
			const displayLayer = deviceAsset?.graphicsLayers.findLast((layer) => layer.type === 'slot' && layer.slot === roomDeviceWearablePart.roomDeviceLink?.slot);
			if (displayLayer?.type === 'slot' && roomDevice?.deployment != null && deviceAsset != null) {
				const [deploymentX, deploymentY, deploymentYOffsetExtra] = projectionResolver.fixupPosition([
					roomDevice.deployment.x,
					roomDevice.deployment.y,
					roomDevice.deployment.yOffset,
				]);
				const [deviceX, deviceBaseY] = projectionResolver.transform(deploymentX, deploymentY, 0);
				const deviceScale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
				const deviceY = deviceBaseY - deploymentYOffsetExtra;
				const devicePivot = deviceAsset.pivot;

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
			}
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
	}, [baseScale, characterState, evaluator, pivot, posX, posY, projectionResolver, rotationAngle, yOffset, yOffsetExtra]);
}

function RoomCharacterInteractiveImpl({
	globalState,
	character,
	characterState,
	spaceInfo,
	debugConfig,
	projectionResolver,
	shard,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const id = characterState.id;
	const {
		position: dataPosition,
	} = useCharacterData(character);

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

	const {
		yOffsetExtra,
		scale,
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);

	const setPositionRaw = useEvent((newX: number, newY: number): void => {
		shard?.sendMessage('roomCharacterMove', {
			id,
			position: projectionResolver.fixupPosition([newX, newY, yOffsetExtra]),
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
		if (dragging.current) return;
		dragging.current = event.getLocalPosition<Point>(event.currentTarget.parent);
	}, []);

	const onDragMove = useEvent((event: FederatedPointerEvent) => {
		if (!dragging.current || !spaceInfo) return;
		const dragPointerEnd = event.getLocalPosition<Point>(event.currentTarget.parent);

		const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, (dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale), 0);

		setPositionThrottled(newX, newY);
	});

	const onPointerDown = useCallback((event: FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((event: FederatedPointerEvent) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			openContextMenu(character, {
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
		<RoomCharacterDisplay
			globalState={ globalState }
			character={ character }
			characterState={ characterState }
			projectionResolver={ projectionResolver }
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
}

function RoomCharacterDisplay({
	character,
	characterState,
	globalState,
	projectionResolver,
	showName,
	debugConfig,

	quickTransitions = false,
	eventMode,
	cursor,
	hitArea,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}: RoomCharacterDisplayProps & CharacterStateProps): ReactElement | null {
	const {
		name,
		position: dataPosition,
		settings,
		isOnline,
	} = useCharacterData(character);

	const { interfaceChatroomOfflineCharacterFilter, interfaceChatroomCharacterNameFontSize } = useAccountSettings();
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

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
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);

	const backView = characterState.actualPose.view === 'back';

	const scaleX = backView ? -1 : 1;

	const labelX = 0;
	const labelY = PIVOT_TO_LABEL_OFFSET;

	const showDisconnectedIcon = !isOnline && interfaceChatroomOfflineCharacterFilter === 'icon';
	const disconnectedIconTexture = useTexture(disconnectedIcon);
	const disconnectedIconY = labelY + 50;

	showName = useObservable(SettingDisplayCharacterName) && showName;

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

	// If character is in a device, do not render it here, it will be rendered by the device
	const roomDeviceLink = useCharacterRestrictionsManager(globalState, character, (rm) => rm.getRoomDeviceLink());

	const transitionTickerRef = useTickerRef();
	const movementTransitionDuration = !smoothMovementEnabled ? 0 :
		quickTransitions ? CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION :
		CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL;

	if (roomDeviceLink != null)
		return null;

	return (
		<TransitionedContainer
			position={ position }
			scale={ { x: scale, y: scale } }
			zIndex={ zIndex }
			filters={ filters }
			sortableChildren
			eventMode={ eventMode ?? 'auto' }
			cursor={ cursor ?? 'default' }
			hitArea={ hitArea ?? null }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
			onglobalpointermove={ onPointerMove }
			transitionDuration={ movementTransitionDuration }
			tickerRef={ transitionTickerRef }
		>
			<SwapCullingDirection uniqueKey='filter' swap={ filters.length > 0 }>
				<GraphicsCharacter
					characterState={ characterState }
					position={ { x: 0, y: -yOffsetExtra } }
					scale={ { x: scaleX, y: 1 } }
					pivot={ pivot }
					angle={ rotationAngle }
					useBlinking
					movementTransitionDuration={ movementTransitionDuration }
				>
					{
						!debugConfig?.characterDebugOverlay ? null : (
							<Container zIndex={ 99999 }>
								<RoomCharacterDebugGraphicsInner pivot={ pivot } />
							</Container>
						)
					}
				</GraphicsCharacter>
				{
					showName ? (
						<Text
							anchor={ { x: 0.5, y: 0.5 } }
							position={ { x: labelX, y: labelY } }
							style={ new TextStyle({
								fontFamily: THEME_FONT.slice(),
								fontSize: 32 * fontScale,
								fill: settings.labelColor,
								align: 'center',
								dropShadow: { blur: 4 },
							}) }
							text={ name }
						/>
					) : null
				}
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
						<Container zIndex={ 99999 }>
							<RoomCharacterDebugGraphicsOuter pivot={ pivot } hitArea={ hitArea } />
						</Container>
					)
				}
			</SwapCullingDirection>
		</TransitionedContainer>
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

export function RoomCharacterInteractive({
	globalState,
	character,
	...props
}: RoomCharacterInteractiveProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	if (!characterState)
		return null;

	return (
		<RoomCharacterInteractiveImpl
			{ ...props }
			globalState={ globalState }
			character={ character }
			characterState={ characterState }
		/>
	);
}

export function RoomCharacter({
	globalState,
	character,
	...props
}: RoomCharacterDisplayProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	if (!characterState)
		return null;

	return (
		<RoomCharacterDisplay
			{ ...props }
			globalState={ globalState }
			character={ character }
			characterState={ characterState }
		/>
	);
}
