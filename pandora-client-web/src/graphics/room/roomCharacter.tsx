import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	CHARACTER_SETTINGS_DEFAULT,
	CharacterSize,
	GetLogger,
	ICharacterRoomData,
	SpaceClientInfo,
	type AppearanceAction,
	type Coordinates,
	type RoomProjectionResolver,
} from 'pandora-common';
import { CanvasTextMetrics, GraphicsContext, Rectangle, TextStyle, type Cursor, type EventMode, type Filter } from 'pixi.js';
import { memo, ReactElement, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import disconnectedIcon from '../../assets/icons/disconnected.svg';
import statusIconAway from '../../assets/icons/state-away.svg';
import { Character, useCharacterData } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useFetchedResourceText } from '../../common/useFetch.ts';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { useConfirmDialog } from '../../components/dialog/dialog.tsx';
import { THEME_FONT } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_ERROR_THROTTLE, LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { ColoredName } from '../../ui/components/common/coloredName.tsx';
import { ROOM_CONTEXT_MENU_OFFSET, useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { ChatroomDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { useCanMoveCharacter } from '../../ui/screens/room/roomPermissionChecks.tsx';
import { SettingDisplayCharacterName } from '../../ui/screens/room/roomState.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { Text } from '../baseComponents/text.ts';
import type { HitscanEvent } from '../common/hitscan/hitscanContext.ts';
import { useDefineHitscanTarget, type HitscanTargetProps } from '../common/hitscan/hitscanTarget.tsx';
import { PointLike } from '../common/point.ts';
import { TransitionedContainer } from '../common/transitions/transitionedContainer.ts';
import { useCharacterDisplayFilters, useCharacterDisplayStyle } from '../common/visionFilters.tsx';
import { GraphicsCharacter } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MASK_SIZE } from '../layers/graphicsLayerAlphaImageMesh.tsx';
import type { PixiPointLike } from '../reconciler/component.ts';
import { useTickerRef } from '../reconciler/tick.ts';
import { PIVOT_TO_LABEL_OFFSET, useRoomCharacterPosition } from './roomCharacterPosition.ts';

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
	onPointerDown?: (pos: Readonly<HitscanEvent>) => void;
	onPointerUp?: (pos: Readonly<HitscanEvent>) => void;
	onHitscanSelect?: (pos: Readonly<HitscanEvent>) => void;
	onDrag?: (pos: Readonly<HitscanEvent>, start: Readonly<HitscanEvent>) => void;
};

export const CHARACTER_WAIT_DRAG_THRESHOLD = 400; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL = 250; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION = LIVE_UPDATE_THROTTLE; // ms

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
	const confirm = useConfirmDialog();

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

	const {
		yOffsetExtra,
		scale,
	} = useRoomCharacterPosition(characterState, projectionResolver);

	const disableManualMove = characterState.position.following != null && characterState.position.following.followType !== 'leash';
	const canMoveCharacter = useCanMoveCharacter(character);

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

		const action: AppearanceAction = {
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
		};

		Promise.resolve()
			.then(() => {
				// Check if this would result in a prompt
				if (canMoveCharacter !== 'prompt')
					return true;

				dragging.current = null;
				pointerDown.current = null;

				if (setPositionErrorCooldown.current != null && setPositionErrorCooldown.current >= Date.now()) {
					// Skip, we already asked recently
					return false;
				}
				setPositionErrorCooldown.current = Date.now() + LIVE_UPDATE_ERROR_THROTTLE;

				return confirm('Move permission request', 'You do not currently have permission to move this character. Send permission prompt?');
			})
			.then((confirmed) => {
				if (!confirmed)
					return;

				execute(action);
			})
			.catch((err) => {
				GetLogger('RoomCharacterInteractive').error('Error during set position handling:', err);
			});
	});

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const labelX = 0;
	const labelY = PIVOT_TO_LABEL_OFFSET;

	const hitArea = useMemo(() => new Rectangle(labelX - 100, labelY - 50, 200, 100), [labelX, labelY]);

	const dragging = useRef<Readonly<Coordinates> | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((pos: Readonly<HitscanEvent>) => {
		if (dragging.current)
			return;
		dragging.current = pos;
	}, []);

	const onDragMove = useEvent((pos: Readonly<HitscanEvent>) => {
		if (!dragging.current || !spaceInfo)
			return;

		const [newX, newY] = projectionResolver.inverseGivenZ(pos.x, (pos.y - PIVOT_TO_LABEL_OFFSET * scale), 0);

		setPositionThrottled(newX, newY);
	});

	const onPointerDown = useCallback(() => {
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((pos: Readonly<HitscanEvent>) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			openContextMenu({
				type: 'character',
				character,
				position: {
					x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
					y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
				},
			});
		}
		pointerDown.current = null;
	});
	const onHitscanSelect = useEvent((pos: Readonly<HitscanEvent>) => {
		openContextMenu({
			type: 'character',
			character,
			position: {
				x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
				y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
			},
		});
	});

	const onDrag = useCallback((pos: Readonly<HitscanEvent>) => {
		if (dragging.current) {
			onDragMove(pos);
		} else if (pointerDown.current !== null && Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			onDragStart(pos);
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
			onHitscanSelect={ onHitscanSelect }
			onDrag={ onDrag }
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
	onPointerDown,
	onPointerUp,
	onHitscanSelect,
	onDrag,
}: RoomCharacterDisplayProps): ReactElement | null {
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const characterDisplayStyle = useCharacterDisplayStyle(character);
	const characterFilters = useCharacterDisplayFilters(characterDisplayStyle);
	const filters = useMemo(() => [...visionFilters(), ...characterFilters], [visionFilters, characterFilters]);

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

	const innerPosition = useMemo((): PointLike => ({ x: 0, y: -yOffsetExtra }), [yOffsetExtra]);
	const innerScale = useMemo((): PointLike => ({ x: scaleX, y: 1 }), [scaleX]);

	const { held, hover } = useDefineHitscanTarget(useMemo((): HitscanTargetProps | null => {
		if (hitArea == null)
			return null;

		const roomHitArea = new Rectangle(
			position.x + scale * hitArea.x,
			position.y + scale * hitArea.y,
			scale * hitArea.width,
			scale * hitArea.height,
		);

		return {
			hitArea: roomHitArea,
			stopClickPropagation: true,
			// eslint-disable-next-line react/no-unstable-nested-components
			getSelectionButtonContents() {
				const { publicSettings, name, id } = character.data;

				return (
					<><ColoredName color={ publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor }>{ name }</ColoredName> ({ id })</>
				);
			},
			onPointerDown(pos) {
				onPointerDown?.(pos);
			},
			onPointerUp(pos) {
				onPointerUp?.(pos);
			},
			onClick(pos, fromSelectionMenu) {
				if (fromSelectionMenu) {
					onHitscanSelect?.(pos);
				}
			},
			onDrag(pos, start) {
				onDrag?.(pos, start);
			},
		};
	}, [hitArea, onDrag, onPointerDown, onPointerUp, onHitscanSelect, position, scale, character]));

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
