import { Assert, BONE_MAX, BONE_MIN, type BoneDefinition } from 'pandora-common';
import { DEG_TO_RAD, Matrix, Point } from 'pixi.js';

/**
 * Ratio of how much to prefer getting one pixel closer to the target than one degree of squared joint movement.
 * This is done to avoid rapid movement in case completely opposite position would result in a pixel better target.
 */
const TARGET_WEIGHT = 100;

/**
 * Ratio of how much harder it is to move parent bone compared to child bone (parent bone moves more of the body).
 */
const INERTIA_FACTOR = 16;

/**
 * Large movements are penalized by powering their size to this constant - prefering smaller movements.
 * This helps the movement be less volatile at the cost of slightly less precise targetting.
 */
const LARGE_MOVEMENT_POWER = 1.5;

/**
 * Find optimal values the bones and rest of the input.
 * Specifically it tries to find such values for given bones, that the point originally at `startPoint` and transformed by the bones in their given order
 * is as close as possible to the given `target`, while heuristically balancing that with the movement needed from `initialPosition` to reach the target,
 * to avoid numerical errors that lead to very weird behavior.
 *
 * The exact optimum we are looking for is minimizing:
 * ```
 * TARGET_WEIGHT * distance(transform(startPoint), target) + sum(|result_i - initialPosition_i|^2)
 * ```
 *
 * @param bones - Chain of bones that are used for moving target. It is assumed that bone_i is parent of bone_(i+1)
 * @param startPoint - The original position of the point we are moving, before transforms
 * @param target - Where we want to get the point to
 * @param initialPosition - Initial value for each bone, used for minimizing travel distance if possible
 * @returns The calculated optimal rotations for each bone
 */
export function FindInverseKinematicOptimum(
	bones: BoneDefinition[],
	startPoint: readonly [number, number],
	target: readonly [number, number],
	initialPosition: number[],
): number[] {
	Assert(bones.length === initialPosition.length);
	const m = new Matrix();
	const targetPoint = new Point(...target);

	// Helper for calculating distance from the target after applying rotations given as argument.
	function calculateDistance(position: number[]): number {
		const point = new Point(...startPoint);
		m.identity();
		const link = new Point();
		for (let i = 0; i < bones.length; i++) {
			const b = bones[i];
			link.set(b.x, b.y);
			m.apply(link, link);
			m
				.translate(-link.x, -link.y)
				.rotate(position[i] * DEG_TO_RAD * (b.isMirror ? -1 : 1))
				.translate(link.x, link.y);
		}
		return m.apply(point, point).subtract(targetPoint, point).magnitude();
	}

	// Current best solution
	let best: number = TARGET_WEIGHT * calculateDistance(initialPosition);
	let bestPosition = initialPosition.slice();

	// Helper for recursively brute-forcing all possible poses to get the best we can
	const optimizePosition = initialPosition.slice();
	function optimize(currentCost: number, index: number) {
		// If we are out of the chain, calculate the current result and save it if it is better
		if (index >= initialPosition.length) {
			const distance = calculateDistance(optimizePosition);
			const value = TARGET_WEIGHT * distance + currentCost;
			if (value < best) {
				bestPosition = optimizePosition.slice();
				best = value;
			}

			return;
		}

		// If we are still in the bone chain guess the movement (trying smallest first) and recurse into the next chain link
		const p = initialPosition[index];
		const movementFactor = Math.pow(INERTIA_FACTOR, bones.length - index - 1);
		for (let shift = 1; ; shift++) {
			let valid = false;
			const cost = currentCost + Math.pow(shift, LARGE_MOVEMENT_POWER) * movementFactor;
			if (cost >= best) // Bail out if we couldn't find better result than the current one anyway (this is surprisingly common)
				break;

			if (p + shift <= BONE_MAX) {
				valid = true;
				optimizePosition[index] = p + shift;
				optimize(cost, index + 1);
			}
			if (p - shift >= BONE_MIN) {
				valid = true;
				optimizePosition[index] = p - shift;
				optimize(cost, index + 1);
			}

			if (!valid)
				break;
		}
	}

	// Run the optimization
	optimize(0, 0);

	return bestPosition;
}
