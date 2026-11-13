import { Immutable } from 'immer';
import {
	AssetFrameworkCharacterState,
	CalculateCharacterPoseOffsets,
	CloneDeepMutable,
	ItemRoomDevice,
	RoomDeviceGraphicsLayerSlot,
	type RoomProjectionResolver,
} from 'pandora-common';
import { useMemo } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { useObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator, type AppearanceConditionEvaluator, type CharacterPoseEvaluator } from '../appearanceConditionEvaluator.ts';
import type { PointLike } from '../common/point.ts';
import { CHARACTER_PIVOT_POSITION } from '../graphicsCharacter.tsx';
import { EvaluateCondition } from '../utility.ts';

export const PIVOT_TO_LABEL_OFFSET = 100;

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

	// The calculation is shared with game logic (items following a character), so both always agree
	const { baseScale, yOffset, rotationAngle } = CalculateCharacterPoseOffsets(evaluator);

	const pivot = useMemo((): PointLike => ({ x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y - yOffset }), [yOffset]);

	return {
		baseScale,
		yOffset,
		pivot,
		rotationAngle,
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

export interface CalculateCharacterDeviceSlotPositionProps {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerSlot>;
	characterState: AssetFrameworkCharacterState;
	evaluator: AppearanceConditionEvaluator;
	baseScale: number;
	pivot: Readonly<PointLike>;
}

/** Calculates a position of a character in a room device slot */
export function CalculateCharacterDeviceSlotPosition({ item, layer, characterState, evaluator, baseScale, pivot }: CalculateCharacterDeviceSlotPositionProps): {
	/** Position on the room canvas */
	position: Readonly<PointLike>;
	/** Final scale of the character (both pose and room scaling applied) */
	scale: Readonly<PointLike>;
	/** Position of character's pivot (usually between feet; between knees when kneeling) */
	pivot: Readonly<PointLike>;
} {
	const devicePivot = item.asset.definition.pivot;

	const effectiveCharacterPosition = layer.characterPositionOverrides
		?.find((override) => EvaluateCondition(override.condition, (c) => evaluator.evalCondition(c, item)))?.position
		?? layer.characterPosition;

	const x = devicePivot.x + effectiveCharacterPosition.offsetX;
	const y = devicePivot.y + effectiveCharacterPosition.offsetY;

	const scale = (effectiveCharacterPosition.disablePoseOffset ? 1 : baseScale) * (effectiveCharacterPosition.relativeScale ?? 1);

	const backView = characterState.actualPose.view === 'back';

	const scaleX = backView ? -1 : 1;

	const actualPivot: PointLike = CloneDeepMutable(effectiveCharacterPosition.disablePoseOffset ? CHARACTER_PIVOT_POSITION : pivot);
	if (effectiveCharacterPosition.pivotOffset != null) {
		actualPivot.x += effectiveCharacterPosition.pivotOffset.x;
		actualPivot.y += effectiveCharacterPosition.pivotOffset.y;
	}

	return {
		position: { x, y },
		scale: { x: scale * scaleX, y: scale },
		pivot: actualPivot,
	};
}
