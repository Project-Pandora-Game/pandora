import { throttle } from 'lodash-es';
import { Assert, CharacterSize, type AssetFrameworkCharacterState, type BoneDefinition, type PartialAppearancePose } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { useCharacterData } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { usePlayer } from '../../components/gameContext/playerContextProvider.tsx';
import { useWardrobeExecuteCallback, WardrobeActionContextProvider } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { useCanMoveCharacter, useCanPoseCharacter } from '../../ui/screens/room/roomPermissionChecks.tsx';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { TransitionedContainer } from '../common/transitions/transitionedContainer.ts';
import { type PointLike } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MovementHelperGraphics } from '../movementHelper.tsx';
import { useTickerRef } from '../reconciler/tick.ts';
import { GetAngle } from '../utility.ts';
import { CHARACTER_WAIT_DRAG_THRESHOLD, PIVOT_TO_LABEL_OFFSET, useRoomCharacterPosition, type CharacterStateProps, type RoomCharacterInteractiveProps } from './roomCharacter.tsx';

export function RoomCharacterMovementTool({
	globalState,
	character,
	...props
}: RoomCharacterInteractiveProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	if (!characterState)
		return null;

	return (
		<RoomCharacterMovementToolImpl
			{ ...props }
			globalState={ globalState }
			character={ character }
			characterState={ characterState }
		/>
	);
}

function RoomCharacterMovementToolImpl({
	character,
	characterState,
	projectionResolver,
	shard,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const id = characterState.id;
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		shard?.sendMessage('roomCharacterMove', {
			id,
			position: projectionResolver.fixupPosition([newX, newY, newYOffset]),
		});
	}, [id, projectionResolver, shard]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const {
		position: dataPosition,
	} = useCharacterData(character);

	const {
		position,
		yOffsetExtra,
		scale,
		pivot,
		rotationAngle,
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);
	const backView = characterState.actualPose.view === 'back';
	const scaleX = backView ? -1 : 1;

	const labelX = 0;
	const labelY = PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(event.currentTarget.parent.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current) return;

		if (pointerDownTarget.current === 'pos') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(event.currentTarget.parent.parent);

			const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale, 0);

			setPositionThrottled(newX, newY, yOffsetExtra);
		} else if (pointerDownTarget.current === 'offset') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(event.currentTarget.parent);

			const newYOffset = labelY - dragPointerEnd.y;

			setPositionThrottled(dataPosition[0], dataPosition[1], newYOffset);
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
			Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			if (pointerDownTarget.current === 'pos') {
				setRoomSceneMode({ mode: 'normal' });
			} else if (pointerDownTarget.current === 'offset') {
				setPositionThrottled(dataPosition[0], dataPosition[1], 0);
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
			Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	const canPoseCharacter = useCanPoseCharacter(character);

	return (
		<TransitionedContainer
			position={ position }
			scale={ { x: scale, y: scale } }
			transitionDuration={ smoothMovementEnabled ? LIVE_UPDATE_THROTTLE : 0 }
			tickerRef={ useTickerRef() }
		>
			<TransitionedContainer
				position={ { x: 0, y: -yOffsetExtra } }
				scale={ { x: scaleX, y: 1 } }
				pivot={ pivot }
				angle={ rotationAngle }
				transitionDuration={ smoothMovementEnabled ? LIVE_UPDATE_THROTTLE : 0 }
				tickerRef={ useTickerRef() }
			>
				{
					canPoseCharacter !== 'forbidden' ? (
						<SwitchModePosingButton
							position={ { x: 0.5 * CharacterSize.WIDTH, y: 0.4 * CharacterSize.HEIGHT - 90 } }
							radius={ 40 }
							onClick={ () => {
								if (canPoseCharacter === 'prompt') {
									toast(`Attempting to change this character's pose will ask them for permission.`, TOAST_OPTIONS_WARNING);
								}
								setRoomSceneMode({ mode: 'poseCharacter', characterId: id });
							} }
						/>
					) : null
				}
			</TransitionedContainer>
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
				position={ { x: labelX + 110, y: labelY - yOffsetExtra } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
		</TransitionedContainer>
	);
}

export function RoomCharacterPosingTool({
	globalState,
	character,
	...props
}: RoomCharacterInteractiveProps): ReactElement | null {
	const player = usePlayer();
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	if (!player || !characterState)
		return null;

	return (
		<WardrobeActionContextProvider player={ player }>
			<RoomCharacterPosingToolImpl
				{ ...props }
				globalState={ globalState }
				character={ character }
				characterState={ characterState }
			/>
		</WardrobeActionContextProvider>
	);
}

function RoomCharacterPosingToolImpl({
	character,
	characterState,
	projectionResolver,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const id = characterState.id;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });
	const setPoseDirect = useCallback(({ arms, leftArm, rightArm, ...copy }: PartialAppearancePose) => {
		execute({
			type: 'pose',
			target: id,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
			...copy,
		});
	}, [execute, id]);

	const setPose = useMemo(() => throttle(setPoseDirect, LIVE_UPDATE_THROTTLE), [setPoseDirect]);

	const {
		position: dataPosition,
	} = useCharacterData(character);

	const {
		position,
		yOffsetExtra,
		scale,
		pivot,
		rotationAngle,
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);
	const backView = characterState.actualPose.view === 'back';
	const scaleX = backView ? -1 : 1;

	const characterRotationBone = bones.find((bone) => bone.name === 'character_rotation');
	Assert(characterRotationBone != null, 'Character rotation bone not found');

	const canMoveCharacter = useCanMoveCharacter(character);

	return (
		<Container
			position={ position }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
		>
			<Container
				position={ { x: pivot.x, y: pivot.y - yOffsetExtra } }
				scale={ { x: scaleX, y: 1 } }
				pivot={ pivot }
				angle={ rotationAngle }
			>
				{
					bones
						.filter((b) => b.x !== 0 && b.y !== 0)
						.map((bone) => (
							<PosingToolBone
								key={ bone.name }
								characterState={ characterState }
								definition={ bone }
								onRotate={ (newRotation) => {
									setPose({
										bones: {
											[bone.name]: newRotation,
										},
									});
								} }
							/>
						))
				}
				{
					canMoveCharacter ? (
						<SwitchModeMovementButton
							position={ { x: 0.5 * CharacterSize.WIDTH, y: 0.4 * CharacterSize.HEIGHT - 90 } }
							radius={ 40 }
							onClick={ () => {
								setRoomSceneMode({ mode: 'moveCharacter', characterId: id });
							} }
						/>
					) : null
				}
				<ExitPosingUiButton
					position={ { x: 0.5 * CharacterSize.WIDTH, y: 0.4 * CharacterSize.HEIGHT } }
					radius={ 40 }
					onClick={ () => {
						setRoomSceneMode({ mode: 'normal' });
					} }
				/>
				<TurnAroundButton
					position={ { x: pivot.x, y: pivot.y + 80 } }
					radiusSmall={ 20 }
					radiusBig={ 32 }
					onClick={ () => {
						setPose({
							view: characterState.requestedPose.view === 'front' ? 'back' : 'front',
						});
					} }
				/>
			</Container>
			<PosingToolBone
				characterState={ characterState }
				definition={ characterRotationBone }
				bonePoseOverride={ { x: pivot.x, y: pivot.y - yOffsetExtra } }
				onRotate={ (newRotation) => {
					setPose({
						bones: {
							[characterRotationBone.name]: newRotation,
						},
					});
				} }
			/>
		</Container>
	);
}

type PosingToolBoneProps = {
	bonePoseOverride?: Readonly<PointLike>;
	definition: BoneDefinition;
	characterState: AssetFrameworkCharacterState;
	onRotate: (newRotation: number) => void;
};

function PosingToolBone({
	bonePoseOverride,
	definition,
	characterState,
	onRotate,
}: PosingToolBoneProps): ReactElement {
	const radius = 30;
	const arrowBodyLength = 10;
	const arrowWidthInner = 2;
	const arrowWidth = 8;
	const centerOffset = 5;

	const hitArea = useMemo(() => new PIXI.Rectangle(-radius, -radius, 2 * radius, 2 * radius), [radius]);
	const graphicsRef = useRef<PIXI.Graphics>(null);

	const evaluator = useAppearanceConditionEvaluator(characterState);

	const [posX, posY, angle] = useMemo((): [number, number, number] => {
		let rotation = evaluator.getBoneLikeValue(definition.name) + (definition.baseRotation ?? 0);
		let x = bonePoseOverride?.x ??
			(definition.x + (definition.uiPositionOffset?.[0] ?? 0));
		let y = bonePoseOverride?.y ??
			(definition.y + (definition.uiPositionOffset?.[1] ?? 0));
		if (definition.parent) {
			rotation += evaluator.getBoneLikeValue(definition.parent.name);
			[x, y] = evaluator.evalTransform([x, y], [{ type: 'rotate', bone: definition.parent.name, value: definition.isMirror ? -1 : 1 }], definition.isMirror, null);
		}
		if (definition.isMirror) {
			rotation = 180 - rotation;
		}
		return [x, y, rotation];
	}, [definition, evaluator, bonePoseOverride]);

	const onMove = useEvent((x: number, y: number): void => {
		let graphicsAngle = GetAngle(x - posX, y - posY);
		if (definition.isMirror) {
			graphicsAngle = ((180 + 360) - graphicsAngle) % 360;
		}
		if (definition.parent) {
			graphicsAngle -= evaluator.getBoneLikeValue(definition.parent.name);
		}
		let rotation = graphicsAngle - (definition.baseRotation ?? 0);
		rotation = (Math.round(rotation)) % 360;
		if (rotation < -180) {
			rotation += 360;
		} else if (rotation > 180) {
			rotation -= 360;
		}
		onRotate(rotation);
	});

	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !graphicsRef.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(graphicsRef.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !graphicsRef.current) return;

		const dragPointerEnd = event.getLocalPosition(graphicsRef.current.parent);
		onMove(
			dragPointerEnd.x,
			dragPointerEnd.y,
		);
	});

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (
			pointerDown.current !== null &&
			Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			onRotate(0);
		}
		pointerDown.current = null;
	});

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (
			pointerDown.current !== null &&
			Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.ellipse(0, 0, radius, radius)
			.fill({ color: 0x000000, alpha: 0.4 })
			.stroke({ width: 4, color: 0xffffff, alpha: 1 })
			.poly([
				centerOffset, -arrowWidthInner,
				centerOffset + arrowBodyLength, -arrowWidthInner,
				centerOffset + arrowBodyLength, -arrowWidth,
				radius, 0,
				centerOffset + arrowBodyLength, arrowWidth,
				centerOffset + arrowBodyLength, arrowWidthInner,
				centerOffset, arrowWidthInner,
			])
			.fill({ color: 0xffffff, alpha: 1 })
			.ellipse(0, 0, centerOffset, centerOffset)
			.fill({ color: 0xffffff, alpha: 1 });
	}, []);

	return (
		<Graphics
			ref={ graphicsRef }
			x={ posX }
			y={ posY }
			angle={ angle }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='move'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
			onglobalpointermove={ onPointerMove }
		/>
	);
}

function SwitchModeMovementButton({
	position,
	radius,
	onClick,
}: {
	position: Readonly<PointLike>;
	radius: number;
	onClick: () => void;
}): ReactElement {
	const hitArea = useMemo(() => new PIXI.Rectangle(-radius, -radius, 2 * radius, 2 * radius), [radius]);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		onClick();
	}, [onClick]);

	return (
		<MovementHelperGraphics
			radius={ radius }
			colorLeftRight={ 0xffffff }
			colorUpDown={ 0xffffff }
			position={ position }
			hitArea={ hitArea }
			eventMode='static'
			cursor='pointer'
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
		/>
	);
}

function SwitchModePosingButton({
	position,
	radius,
	onClick,
}: {
	position: Readonly<PointLike>;
	radius: number;
	onClick: () => void;
}): ReactElement {
	const hitArea = useMemo(() => new PIXI.Rectangle(-radius, -radius, 2 * radius, 2 * radius), [radius]);
	/** Sized 24x24 */
	const POSING_ICON_PATH = 'M12 1a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm8.79 4.546L14.776 6H9.223l-6.012-.454a.72.72 0 0 0-.168 1.428l6.106.97a.473.473 0 0 1 .395.409L10 12 6.865 22.067a.68.68 0 0 0 .313.808l.071.04a.707.707 0 0 0 .994-.338L12 13.914l3.757 8.663a.707.707 0 0 0 .994.338l.07-.04a.68.68 0 0 0 .314-.808L14 12l.456-3.647a.473.473 0 0 1 .395-.409l6.106-.97a.72.72 0 0 0-.168-1.428z';

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		onClick();
	}, [onClick]);

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.ellipse(0, 0, radius, radius)
			.fill({ color: 0x000000, alpha: 0.4 })
			.stroke({ width: 4, color: 0xffffff, alpha: 1 });

		const iconButtonSize = 1.8 * (radius / 24);
		g
			.transform(iconButtonSize, 0, 0, iconButtonSize, -12 * iconButtonSize, -12 * iconButtonSize)
			.path(new PIXI.GraphicsPath(POSING_ICON_PATH))
			.resetTransform()
			.fill({ color: 0xffffff, alpha: 1 });
	}, [radius]);

	return (
		<Graphics
			position={ position }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
		/>
	);
}

function ExitPosingUiButton({
	position,
	radius,
	onClick,
}: {
	position: Readonly<PointLike>;
	radius: number;
	onClick: () => void;
}): ReactElement {
	const innerWidth = 2;
	const sideGap = 5;

	const hitArea = useMemo(() => new PIXI.Rectangle(-radius, -radius, 2 * radius, 2 * radius), [radius]);

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.ellipse(0, 0, radius, radius)
			.fill({ color: 0x880000, alpha: 0.4 })
			.stroke({ width: 4, color: 0xffaaaa, alpha: 1 })
			.poly([
				innerWidth, -innerWidth,
				radius - sideGap, -innerWidth,
				radius - sideGap, innerWidth,
				innerWidth, innerWidth,
				innerWidth, radius - sideGap,
				-innerWidth, radius - sideGap,
				-innerWidth, innerWidth,
				-(radius - sideGap), innerWidth,
				-(radius - sideGap), -innerWidth,
				-innerWidth, -innerWidth,
				-innerWidth, -(radius - sideGap),
				innerWidth, -(radius - sideGap),
			])
			.fill({ color: 0xaa0000, alpha: 1 });
	}, [radius]);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		onClick();
	}, [onClick]);

	return (
		<Graphics
			position={ position }
			angle={ 45 }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
		/>
	);
}

function TurnAroundButton({
	position,
	radiusSmall,
	radiusBig,
	onClick,
}: {
	position: Readonly<PointLike>;
	radiusSmall: number;
	radiusBig: number;
	onClick: () => void;
}): ReactElement {
	const arrowheadLength = 0.4 * radiusBig;
	const innerSize = 0.2 * radiusSmall;
	const arrowheadWidth = 0.6 * radiusSmall;
	const edgeWidth = 4;

	const hitArea = useMemo(() => new PIXI.Rectangle(-radiusBig, -radiusSmall, 2 * radiusBig, 2 * radiusSmall), [radiusBig, radiusSmall]);

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(-radiusBig, -radiusSmall, 2 * radiusBig, 2 * radiusSmall)
			.fill({ color: 0x880000, alpha: 0.4 })
			.stroke({ width: 4, color: 0xffffff, alpha: 1 })
			.poly([
				radiusBig - edgeWidth - arrowheadLength, -innerSize,
				radiusBig - edgeWidth - arrowheadLength, -arrowheadWidth,
				radiusBig - edgeWidth, 0,
				radiusBig - edgeWidth - arrowheadLength, arrowheadWidth,
				radiusBig - edgeWidth - arrowheadLength, innerSize,

				- radiusBig + edgeWidth + arrowheadLength, innerSize,
				- radiusBig + edgeWidth + arrowheadLength, arrowheadWidth,
				- radiusBig + edgeWidth, 0,
				- radiusBig + edgeWidth + arrowheadLength, -arrowheadWidth,
				- radiusBig + edgeWidth + arrowheadLength, -innerSize,
			])
			.fill({ color: 0xffffff, alpha: 1 });
	}, [arrowheadLength, arrowheadWidth, innerSize, radiusBig, radiusSmall]);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		onClick();
	}, [onClick]);

	return (
		<Graphics
			position={ position }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
		/>
	);
}
