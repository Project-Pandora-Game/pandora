import { throttle } from 'lodash';
import { Assert, type AssetFrameworkCharacterState, type BoneDefinition, type PartialAppearancePose } from 'pandora-common';
import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback, useMemo, useRef } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { useCharacterData } from '../../character/character';
import { useEvent } from '../../common/useEvent';
import { usePlayer } from '../../components/gameContext/playerContextProvider';
import { useWardrobeExecuteCallback, WardrobeContextProvider } from '../../components/wardrobe/wardrobeContext';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator';
import { Container } from '../baseComponents/container';
import { Graphics } from '../baseComponents/graphics';
import { type PointLike } from '../graphicsCharacter';
import { MovementHelperGraphics } from '../movementHelper';
import { GetAngle } from '../utility';
import { CHARACTER_WAIT_DRAG_THRESHOLD, PIVOT_TO_LABEL_OFFSET, useRoomCharacterPosition, type CharacterStateProps, type RoomCharacterInteractiveProps } from './roomCharacter';

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
	setRoomSceneMode,
	shard,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const id = characterState.id;

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		shard?.sendMessage('roomCharacterMove', {
			id,
			position: projectionResolver.fixupPosition([newX, newY, newYOffset]),
		});
	}, [id, projectionResolver, shard]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, 100), [setPositionRaw]);

	const {
		position: dataPosition,
	} = useCharacterData(character);

	const {
		position,
		yOffsetExtra,
		scale,
		pivot,
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const movementHelpersContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !movementHelpersContainer.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !movementHelpersContainer.current) return;

		if (pointerDownTarget.current === 'pos') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current.parent);

			const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale, 0);

			setPositionThrottled(newX, newY, yOffsetExtra);
		} else if (pointerDownTarget.current === 'offset') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current);

			const newYOffset = (dragPointerEnd.y - labelY) * -scale;

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

	return (
		<Container
			ref={ movementHelpersContainer }
			position={ position }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
		>
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
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
		</Container>
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
		<WardrobeContextProvider player={ player } target={ character }>
			<RoomCharacterPosingToolImpl
				{ ...props }
				globalState={ globalState }
				character={ character }
				characterState={ characterState }
			/>
		</WardrobeContextProvider>
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

	const setPose = useMemo(() => throttle(setPoseDirect, 100), [setPoseDirect]);

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
