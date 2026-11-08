import type { Immutable } from 'immer';
import { DEG_TO_RAD } from '../../math/index.ts';
import { CharacterSize } from '../graphics/graphics.ts';
import type { AppearancePose } from './characterStatePose.ts';

/** Position (in character-local pixels) of the pivot of a character without any pose offsets - the point where heels touch the floor. */
export const CHARACTER_PIVOT_BASE = {
	x: CharacterSize.WIDTH / 2, // Middle of the character image
	y: 1290,
} as const;

type LegsPoseName = AppearancePose['legs']['pose'];

const LEG_EFFECT_MAP: Record<LegsPoseName, number> = {
	standing: 600,
	sitting: 0,
	kneeling: 242,
};

/**
 * Calculates the pose-dependent offsets used for placing a character in a room.
 * Shared between the client (rendering) and the game logic (items that follow a character), so they can never disagree.
 * @param evaluator - Anything that can evaluate the pose of the character (usually `CharacterPoseTransforms`)
 */
export function CalculateCharacterPoseOffsets(evaluator: {
	readonly pose: Immutable<AppearancePose>;
	getBoneLikeValue(name: string): number;
}): {
	/** Scale generated from pose */
	baseScale: number;
	/** Y offset based on pose and items. Affects pivot. Doesn't include manual offset. */
	yOffset: number;
	/** Angle (in degrees) of whole-character rotation */
	rotationAngle: number;
} {
	let baseScale = 1;
	if (evaluator.pose.legs.pose === 'sitting') {
		baseScale *= 0.9;
	}

	const legEffectCharacterOffsetBase = evaluator.pose.legs.pose === 'sitting' ? 135 : LEG_EFFECT_MAP.standing;
	const legEffect = LEG_EFFECT_MAP[evaluator.pose.legs.pose]
		+ (evaluator.pose.legs.pose !== 'kneeling' ? 0.11 : 0) * evaluator.getBoneLikeValue('tiptoeing');

	const effectiveLegAngle = Math.min(Math.abs(evaluator.getBoneLikeValue('leg_l')), Math.abs(evaluator.getBoneLikeValue('leg_r')), 90);

	const yOffset = 0
		+ legEffectCharacterOffsetBase
		- legEffect * Math.cos(DEG_TO_RAD * effectiveLegAngle);

	return {
		baseScale,
		yOffset,
		rotationAngle: evaluator.getBoneLikeValue('character_rotation'),
	};
}
