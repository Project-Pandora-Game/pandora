import * as z from 'zod';
import { AccountIdSchema } from '../account/account.ts';
import { LIMIT_SPACE_NAME_LENGTH, LIMIT_SPACE_NAME_PATTERN } from '../inputLimits.ts';
import { SpaceIdSchema, SpacePublicSettingSchema } from './space.ts';
import { SpaceBaseInfoSchema } from './spaceData.ts';

/** The ordering for how should spaces be returned */
export const SpaceSearchSortSchema = z.enum(['activity', 'a-z', 'z-a']);
/** The ordering for how should spaces be returned */
export type SpaceSearchSort = z.infer<typeof SpaceSearchSortSchema>;

export const SpaceSearchNameFilterSchema = z.string().max(LIMIT_SPACE_NAME_LENGTH).regex(LIMIT_SPACE_NAME_PATTERN);
export type SpaceSearchNameFilter = z.infer<typeof SpaceSearchNameFilterSchema>;

/** Arguments for space search query */
export const SpaceSearchArgumentsSchema = z.object({
	nameFilter: SpaceSearchNameFilterSchema.optional(),
	sort: SpaceSearchSortSchema,
});
/** Arguments for space search query */
export type SpaceSearchArguments = z.infer<typeof SpaceSearchArgumentsSchema>;

export const SpaceSearchResultEntrySchema = z.object({
	/** The id of the space, never changes */
	id: SpaceIdSchema,
	/** The name of the space */
	name: SpaceBaseInfoSchema.shape.name,
	/** The description of the space */
	description: SpaceBaseInfoSchema.shape.description,
	/**
	 * Whether the space is private or public (under some conditions)
	 * @see SpacePublicSettingSchema
	 */
	public: SpacePublicSettingSchema,
	/** The maximum amount of characters that can be present at once in the space */
	maxUsers: SpaceBaseInfoSchema.shape.maxUsers,
	/** List of the space's owners */
	owners: AccountIdSchema.array(),
	/**
	 * The activity score - how much this space was active recently.
	 * It should be assumed that besides this number being finite, there is no meaning that can be gained from this.
	 * The heuristic behind this number can change over time.
	 */
	activityScore: z.number(),
});
export type SpaceSearchResultEntry = z.infer<typeof SpaceSearchResultEntrySchema>;

export const SpaceSearchResultSchema = SpaceSearchResultEntrySchema.array();
export type SpaceSearchResult = z.infer<typeof SpaceSearchResultSchema>;
