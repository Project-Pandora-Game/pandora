import { produce, type Immutable } from 'immer';
import { throttle } from 'lodash-es';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, Assert, CharacterSize, EMPTY_ARRAY, type AssetFrameworkCharacterState, type BoneDefinition, type InversePosingHandle, type PartialAppearancePose } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useInterfaceAccentColorPacked } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { usePlayer } from '../../components/gameContext/playerContextProvider.tsx';
import { useWardrobeExecuteCallback, WardrobeActionContextProvider } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { useCanMoveCharacter, useCanPoseCharacter } from '../../ui/screens/room/roomPermissionChecks.tsx';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { TransitionedContainer } from '../common/transitions/transitionedContainer.ts';
import { type PointLike } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { MovementHelperGraphics, PosingStateHelperGraphics } from '../movementHelper.tsx';
import { useTickerRef } from '../reconciler/tick.ts';
import { GetAngle } from '../utility.ts';
import { FindInverseKinematicOptimum } from '../utility/inverseKinematics.ts';
import { CHARACTER_WAIT_DRAG_THRESHOLD, PIVOT_TO_LABEL_OFFSET, useRoomCharacterPosition, type CharacterStateProps, type RoomCharacterInteractiveProps } from './roomCharacter.tsx';
import type { RoomProjectionResolver } from './roomScene.tsx';

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
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const id = characterState.id;
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const disableManualMove = characterState.position.following != null;

	const setPositionRaw = useEvent((newX: number, newY: number, newYOffset: number) => {
		if (disableManualMove) {
			toast('Character that is following another character cannot be moved manually.', TOAST_OPTIONS_WARNING);
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
				position: projectionResolver.fixupPosition([newX, newY, newYOffset]),
			},
		});
	});

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const {
		position,
		yOffsetExtra,
		scale,
		pivot,
		rotationAngle,
	} = useRoomCharacterPosition(characterState, projectionResolver);
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

			setPositionThrottled(characterState.position.position[0], characterState.position.position[1], newYOffset);
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
				setPositionThrottled(characterState.position.position[0], characterState.position.position[1], 0);
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
	const { interfacePosingStyle } = useAccountSettings();

	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const graphicsManager = useObservable(GraphicsManagerInstance);
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
		position,
		yOffsetExtra,
		scale,
		pivot,
		rotationAngle,
	} = useRoomCharacterPosition(characterState, projectionResolver);
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
			<PosingToolIKHandle
				ikHandle={ useMemo(() => ({
					parentBone: characterRotationBone.name,
					style: 'left-right',
					x: pivot.x,
					y: 650 - yOffsetExtra,
				}), [characterRotationBone, pivot.x, yOffsetExtra]) }
				characterState={ characterState }
				projectionResolver={ projectionResolver }
				setPose={ setPose }
			/>
			<Container
				position={ { x: pivot.x, y: pivot.y - yOffsetExtra } }
				scale={ { x: scaleX, y: 1 } }
				pivot={ pivot }
				angle={ rotationAngle }
			>
				<ExitPosingUiButton
					position={ { x: 0.5 * CharacterSize.WIDTH, y: pivot.y + PIVOT_TO_LABEL_OFFSET } }
					radius={ 35 }
					onClick={ () => {
						setRoomSceneMode({ mode: 'normal' });
					} }
				/>
				{
					canMoveCharacter !== 'forbidden' ? (
						<SwitchModeMovementButton
							position={ { x: 0.5 * CharacterSize.WIDTH, y: 0.4 * CharacterSize.HEIGHT - 90 } }
							radius={ 40 }
							onClick={ () => {
								if (canMoveCharacter === 'prompt') {
									toast(`Attempting to move this character will ask them for permission.`, TOAST_OPTIONS_WARNING);
								}
								setRoomSceneMode({ mode: 'moveCharacter', characterId: id });
							} }
						/>
					) : null
				}
				{
					(interfacePosingStyle === 'forward' || interfacePosingStyle === 'both') ? (
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
					) : null
				}
				{
					(interfacePosingStyle === 'inverse' || interfacePosingStyle === 'both') ? (
						graphicsManager?.inversePosingHandles.map((h, i) => (
							<PosingToolIKHandle
								key={ i }
								ikHandle={ h }
								characterState={ characterState }
								projectionResolver={ projectionResolver }
								setPose={ setPose }
							/>
						))
					) : null
				}
				<TurnAroundButton
					position={ { x: pivot.x, y: pivot.y + 25 } }
					radiusSmall={ 20 }
					radiusBig={ 32 }
					onClick={ () => {
						setPose({
							view: characterState.requestedPose.view === 'front' ? 'back' : 'front',
						});
					} }
				/>
				<SwitchHandPositionButton
					position={ { x: pivot.x + 100, y: pivot.y + 80 } }
					radius={ 25 }
					poseIndex={ ArmPoseSchema.options.indexOf(characterState.requestedPose.leftArm.position) }
					poseCount={ ArmPoseSchema.options.length }
					onClick={ () => {
						setPose({
							leftArm: {
								position: characterState.requestedPose.leftArm.position === 'front_above_hair' ? 'front' :
								characterState.requestedPose.leftArm.position === 'front' ? 'back' :
								characterState.requestedPose.leftArm.position === 'back' ? 'back_below_hair' :
								'front_above_hair',
							},
						});
					} }
				/>
				<SwitchHandPositionButton
					position={ { x: pivot.x - 100, y: pivot.y + 80 } }
					radius={ 25 }
					poseIndex={ ArmPoseSchema.options.indexOf(characterState.requestedPose.rightArm.position) }
					poseCount={ ArmPoseSchema.options.length }
					onClick={ () => {
						setPose({
							rightArm: {
								position: characterState.requestedPose.rightArm.position === 'front_above_hair' ? 'front' :
								characterState.requestedPose.rightArm.position === 'front' ? 'back' :
								characterState.requestedPose.rightArm.position === 'back' ? 'back_below_hair' :
								'front_above_hair',
							},
						});
					} }
				/>
			</Container>
		</Container>
	);
}

type PosingToolIKHandleProps = {
	ikHandle: Immutable<InversePosingHandle>;
	characterState: AssetFrameworkCharacterState;
	projectionResolver: Immutable<RoomProjectionResolver>;
	setPose: (newPose: PartialAppearancePose) => void;
};

/** A single inverse kinematics posing handle. Handles are defined in asset repository. */
function PosingToolIKHandle({
	ikHandle,
	characterState,
	projectionResolver,
	setPose,
}: PosingToolIKHandleProps): ReactElement {
	const assetManager = useAssetManager();

	const hitAreaRadius = 25;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);
	const graphicsRef = useRef<PIXI.Graphics>(null);

	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const [open, setOpen] = useState(true);
	const styleHasOpen = ikHandle.style === 'hand-left' || ikHandle.style === 'hand-right';

	const {
		yOffsetExtra,
		pivot,
	} = useRoomCharacterPosition(characterState, projectionResolver);

	const { bones } = useMemo((): {
		bones: BoneDefinition[];
	} => {
		const tmpBones: BoneDefinition[] = [];

		let parentBone: BoneDefinition | undefined = assetManager.getBoneByName(ikHandle.parentBone);
		while (parentBone != null) {
			// Special handling for the character rotation bone
			if (parentBone.name === 'character_rotation') {
				Assert(parentBone.x === 0 && parentBone.y === 0);
				Assert(parentBone.parent == null);
				parentBone = produce(parentBone, (d) => {
					d.x = pivot.x;
					d.y = pivot.y - yOffsetExtra;
				});
			}
			tmpBones.unshift(parentBone);
			parentBone = parentBone.parent;
		}

		return {
			bones: tmpBones,
		};
	}, [assetManager, ikHandle, yOffsetExtra, pivot]);

	const evaluator = useAppearanceConditionEvaluator(characterState);
	const handlePosition = useMemo(() => evaluator.evalTransform([ikHandle.x, ikHandle.y], ikHandle.transforms ?? EMPTY_ARRAY, false, null), [ikHandle, evaluator]);

	const onMove = useEvent((x: number, y: number): void => {
		const result = FindInverseKinematicOptimum(
			bones,
			handlePosition,
			[x, y],
			bones.map((b) => (characterState.actualPose.bones[b.name] ?? 0)),
		);

		const newRotation: Record<string, number> = {};
		Assert(result.length === bones.length);
		for (let i = 0; i < bones.length; i++) {
			newRotation[bones[i].name] = result[i];
		}
		setPose({ bones: newRotation });
	});

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
		if (event.button !== 1) {
			event.stopPropagation();
			pointerDown.current = Date.now();
		}
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (
			pointerDown.current !== null &&
			Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			// Handle short click
			if (styleHasOpen) {
				// Toggle open for those that support that
				setOpen((v) => !v);
			} else {
				// Reset all relevant bones on short click
				const newRotation: Record<string, number> = {};
				for (const b of bones) {
					newRotation[b.name] = 0;
				}
				setPose({ bones: newRotation });
			}
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

	const { currentPosition, currentAngle } = useMemo((): { currentPosition: PIXI.Point; currentAngle: number; } => {
		const point = new PIXI.Point(...handlePosition);
		const m = new PIXI.Matrix().identity();
		const link = new PIXI.Point();
		let tmpAngle = 0;
		for (const b of bones) {
			const value = (characterState.actualPose.bones[b.name] ?? 0) * (b.isMirror ? -1 : 1);
			tmpAngle += value;
			link.set(b.x, b.y);
			m.apply(link, link);
			m
				.translate(-link.x, -link.y)
				.rotate(value * PIXI.DEG_TO_RAD)
				.translate(link.x, link.y);
		}
		return {
			currentPosition: m.apply(point, point),
			currentAngle: tmpAngle,
		};
	}, [handlePosition, bones, characterState.actualPose]);

	const drawExtra = useCallback((g: PIXI.GraphicsContext) => {
		if (ikHandle.style === 'hand-left' || ikHandle.style === 'hand-right') {
			/** Sized 32x32 */
			const POSING_ICON_PATH = 'M20.903 24.014l2.959-3.984 3.475-3.32s-1.158-1.381-2.59-1.381c-.643 0-1.232.184-1.77.552s-1.023.918-1.463 1.655c-.615.215-1.094.42-1.438.615-.076-.766-.168-1.333-.275-1.7l1.996-7.748c.473-1.868.586-2.812-.539-3.312s-2.275.879-2.867 2.637l-1.893 5.983.057-7.694c0-1.889-.596-2.833-1.788-2.833-1.204 0-1.805.837-1.805 2.51v7.692l-1.936-6.738c-.48-1.192-1.325-2.366-2.45-1.991s-1.072 2.226-.76 3.411l1.725 6.569-2.782-4.595c-.851-1.475-2.319-1.76-2.651-1.416-.529.549-.883 1.717.077 3.394l3.069 5.343 2.74 9.492V29h8v-2.379c.929-.637 1.732-1.506 2.909-2.607h0z';

			const iconButtonSize = 1.8 * (hitAreaRadius / 32);
			g
				.rotate(90 * PIXI.DEG_TO_RAD)
				.transform(iconButtonSize, 0, 0, iconButtonSize, -15 * iconButtonSize, -15 * iconButtonSize)
				.scale(ikHandle.style === 'hand-left' ? 1 : -1, -1)
				.path(new PIXI.GraphicsPath(POSING_ICON_PATH))
				.resetTransform()
				.fill({ color: 0xffffff, alpha: open ? 1 : 0.75 });
		}
	}, [hitAreaRadius, ikHandle, open]);

	return (
		<>
			<MovementHelperGraphics
				ref={ graphicsRef }
				radius={ hitAreaRadius }
				colorUpDown={ (ikHandle.style === 'up-down' || ikHandle.style === 'move') ? 0xcccccc : undefined }
				colorLeftRight={ (ikHandle.style === 'left-right' || ikHandle.style === 'move') ? 0xcccccc : undefined }
				drawExtra={ drawExtra }
				angle={ currentAngle }
				position={ { x: currentPosition.x, y: currentPosition.y } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='move'
				onpointerdown={ onPointerDown }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
			{
				(open && styleHasOpen) ? (
					<Container
						angle={ currentAngle }
						position={ { x: currentPosition.x, y: currentPosition.y } }
					>
						{
							(ikHandle.style === 'hand-left' || ikHandle.style === 'hand-right') ? (
								<>
									<PosingStateHelperGraphics
										values={ ArmRotationSchema.options }
										centerValue={ ArmRotationSchema.options.indexOf('forward') }
										value={ characterState.requestedPose[ikHandle.style === 'hand-left' ? 'leftArm' : 'rightArm'].rotation }
										onChange={ (newValue) => {
											setPose({
												[ikHandle.style === 'hand-left' ? 'leftArm' : 'rightArm']: {
													rotation: newValue,
												},
											});
										} }
										x={ ikHandle.style === 'hand-left' ? -60 : 60 }
										y={ 0 }
										angle={ 90 }
									/>
									<PosingStateHelperGraphics
										values={ ArmFingersSchema.options }
										value={ characterState.requestedPose[ikHandle.style === 'hand-left' ? 'leftArm' : 'rightArm'].fingers }
										centerValue={ 1 }
										onChange={ (newValue) => {
											setPose({
												[ikHandle.style === 'hand-left' ? 'leftArm' : 'rightArm']: {
													fingers: newValue,
												},
											});
										} }
										x={ 0 }
										y={ 60 }
										angle={ ikHandle.style === 'hand-left' ? 180 : 0 }
									/>
								</>
							) : null
						}
					</Container>
				) : null
			}
		</>
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
		if (event.button !== 1) {
			event.stopPropagation();
			pointerDown.current = Date.now();
		}
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
	const held = useRef(false);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			held.current = true;
		}
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
			onClick();
		}
	}, [onClick]);

	const onPointerUpOutside = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
		}
	}, []);

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
			onpointerupoutside={ onPointerUpOutside }
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
	const held = useRef(false);
	/** Sized 24x24 */
	const POSING_ICON_PATH = 'M12 1a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm8.79 4.546L14.776 6H9.223l-6.012-.454a.72.72 0 0 0-.168 1.428l6.106.97a.473.473 0 0 1 .395.409L10 12 6.865 22.067a.68.68 0 0 0 .313.808l.071.04a.707.707 0 0 0 .994-.338L12 13.914l3.757 8.663a.707.707 0 0 0 .994.338l.07-.04a.68.68 0 0 0 .314-.808L14 12l.456-3.647a.473.473 0 0 1 .395-.409l6.106-.97a.72.72 0 0 0-.168-1.428z';

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			held.current = true;
		}
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
			onClick();
		}
	}, [onClick]);

	const onPointerUpOutside = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
		}
	}, []);

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
			onpointerupoutside={ onPointerUpOutside }
		/>
	);
}

function SwitchHandPositionButton({
	position,
	radius,
	onClick,
	poseIndex,
	poseCount,
}: {
	position: Readonly<PointLike>;
	radius: number;
	onClick: () => void;
	poseIndex: number;
	poseCount: number;
}): ReactElement {
	const accentColor = useInterfaceAccentColorPacked();
	const hitArea = useMemo(() => new PIXI.Rectangle(-radius, -radius, 2 * radius, 2 * radius), [radius]);
	const held = useRef(false);
	/** Sized 32x32 */
	const POSING_ICON_PATH_1 = 'M25 14a1 1 0 0 1-1-1v-2a5.006 5.006 0 0 0-5-5h-2a1 1 0 0 1 0-2h2a7.008 7.008 0 0 1 7 7v2a1 1 0 0 1-1 1z';
	const POSING_ICON_PATH_2 = 'M17 8a1 1 0 0 1-.707-.293l-2-2a1 1 0 0 1 0-1.414l2-2a1 1 0 1 1 1.414 1.414L16.414 5l1.293 1.293A1 1 0 0 1 17 8zm-4 20h-2a5.006 5.006 0 0 1-5-5v-4a1 1 0 0 1 2 0v4a3 3 0 0 0 3 3h2a1 1 0 0 1 0 2z';
	const POSING_ICON_PATH_3 = 'M13 30a1 1 0 0 1-.707-1.707L13.586 27l-1.293-1.293a1 1 0 0 1 1.414-1.414l2 2a1 1 0 0 1 0 1.414l-2 2A1 1 0 0 1 13 30zm-1.762-16.966l1.598-2.152 1.877-1.793s-.625-.746-1.399-.746c-.347 0-.665.099-.956.298s-.553.496-.79.894a4.97 4.97 0 0 0-.777.332c-.041-.414-.091-.72-.149-.918l1.078-4.185c.255-1.009.317-1.519-.291-1.789S10.2 3.45 9.881 4.4L8.858 7.631l.031-4.156c0-1.02-.322-1.53-.966-1.53-.65 0-.975.452-.975 1.356v4.155l-1.045-3.64c-.259-.644-.716-1.278-1.323-1.075S4 3.943 4.169 4.583L5.1 8.132 3.598 5.65c-.46-.797-1.253-.951-1.432-.765-.286.297-.477.927.042 1.833l1.658 2.886 1.48 5.127v.997h4.321v-1.285c.502-.344.936-.813 1.571-1.408zm9.382 5.925l-1.598 2.152-1.877 1.793s.625.746 1.399.746c.347 0 .665-.099.956-.298s.553-.496.79-.894a4.97 4.97 0 0 0 .777-.332c.041.414.091.72.149.918l-1.078 4.185c-.255 1.009-.317 1.519.291 1.789s1.229-.475 1.549-1.424L23 24.362l-.031 4.156c0 1.02.322 1.53.966 1.53.65 0 .975-.452.975-1.356v-4.155l1.046 3.639c.259.644.716 1.278 1.323 1.075s.579-1.202.411-1.842l-.932-3.548 1.503 2.482c.46.797 1.253.951 1.432.765.286-.297.477-.927-.042-1.833l-1.658-2.886-1.48-5.127v-.997h-4.321v1.285c-.502.344-.936.813-1.571 1.408z';

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			held.current = true;
		}
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
			onClick();
		}
	}, [onClick]);

	const onPointerUpOutside = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
		}
	}, []);

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		const currentStart = poseIndex / poseCount;

		g
			.rect(-radius, -radius + (2 * radius * currentStart), 2 * radius, 2 * radius / poseCount)
			.fill({ color: accentColor, alpha: 1 });

		g
			.rect(-radius, -radius, 2 * radius, 2 * radius)
			.fill({ color: 0x000000, alpha: 0.4 })
			.stroke({ width: 4, color: 0xffffff, alpha: 1 });

		const iconButtonSize = 1.8 * (radius / 32);
		g
			.transform(iconButtonSize, 0, 0, iconButtonSize, -16 * iconButtonSize, -16 * iconButtonSize)
			.path(new PIXI.GraphicsPath(POSING_ICON_PATH_1))
			.path(new PIXI.GraphicsPath(POSING_ICON_PATH_2))
			.path(new PIXI.GraphicsPath(POSING_ICON_PATH_3))
			.resetTransform()
			.fill({ color: 0xffffff, alpha: 1 });
	}, [accentColor, radius, poseIndex, poseCount]);

	return (
		<Graphics
			position={ position }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUpOutside }
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
	const held = useRef(false);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			held.current = true;
		}
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
			onClick();
		}
	}, [onClick]);

	const onPointerUpOutside = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
		}
	}, []);

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
			onpointerupoutside={ onPointerUpOutside }
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
	const held = useRef(false);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			held.current = true;
		}
	}, []);

	const onPointerUp = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
			onClick();
		}
	}, [onClick]);

	const onPointerUpOutside = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (held.current) {
			event.stopPropagation();
			held.current = false;
		}
	}, []);

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

	return (
		<Graphics
			position={ position }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUpOutside }
		/>
	);
}
