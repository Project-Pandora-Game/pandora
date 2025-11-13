import * as z from 'zod';

/** Data about activity of a space, saved in database. */
export const SpaceActivitySavedDataSchema = z.object({
	/**
	 * Timestamp (ms) of the space last being active (having online characters inside).
	 * Not filled for spaces that were inactive before this was added.
	 */
	lastActive: z.number().optional(),

	/**
	 * The activity score, used for space search.
	 * It should be assumed that besides this number being finite, there is no meaning that can be gained from this.
	 * The heuristic behind this number can change over time.
	 */
	score: z.number(),

	/**
	 * Score for the current time interval of current heuristic algorithm.
	 * This number is maximum number of unique accounts that were online in this space at the same time.
	 */
	currentIntervalScore: z.number(),

	/**
	 * The time at which current measurement interval ends for this space. Used for mass updates of spaces.
	 */
	currentIntervalEnd: z.number().int().nonnegative(),
});
export type SpaceActivitySavedData = z.infer<typeof SpaceActivitySavedDataSchema>;

export const SPACE_ACTIVITY_DATA_DEFAULT: SpaceActivitySavedData = {
	score: 0,
	currentIntervalScore: 0,
	currentIntervalEnd: 0,
};

/**
 * Each interval the existing score is multiplied by this constant.
 */
export const SPACE_ACTIVITY_SCORE_DECAY = 0.5;

/**
 * Threshold under which space is considered long-term inactive.
 */
export const SPACE_ACTIVITY_SCORE_THRESHOLD = 0.005; // This is tuned so if only a single person visited it in the past 7 days, a space will still pass.

/**
 * Gets the point of where next activity measuring interval starts.
 * @param instant - The point from which to calculate
 */
export function SpaceActivityGetNextInterval(instant: number): number {
	const d = new Date(instant);
	d.setUTCDate(d.getUTCDate());
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
}
