/**
 * A function of timing the transition.
 * @param progress - The time-based progress of the transition as value in range [0, 1] (inclusive)
 * @returns - The progress of the transition based on the timing function in range [0, 1] (inclusive)
 */
export type TransitionTimingFunction = (progress: number) => number;

export const TRANSITION_TIMING_LINEAR: TransitionTimingFunction = function (p) {
	return p;
};
