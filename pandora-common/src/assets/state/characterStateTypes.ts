import { z } from 'zod';
import { AppearanceActionSchema } from '../../gameLogic/actionLogic/index.ts';
import { AppearanceItemsBundleSchema, AppearanceItemsDeltaBundleSchema } from '../item/items.ts';
import { AppearancePoseSchema, GetDefaultAppearancePose, PartialAppearancePoseSchema } from './characterStatePose.ts';

export const RestrictionOverrideSchema = z.object({
	type: z.enum(['safemode', 'timeout']),
	allowLeaveAt: z.number(),
});
export type RestrictionOverride = Readonly<z.infer<typeof RestrictionOverrideSchema>>;

export const CharacterActionAttemptSchema = z.object({
	/** Action that is being attempted */
	action: AppearanceActionSchema,
	/** When was the attempt started (timestamp) */
	start: z.number().int().nonnegative(),
	/** What is the soonest that the attempt can be successfully finished (timestamp) */
	finishAfter: z.number().int().nonnegative(),
});
export type CharacterActionAttempt = z.infer<typeof CharacterActionAttemptSchema>;

export type RestrictionOverrideConfig = Readonly<{
	allowLeaveAt: number;
	blockInteractions: boolean;
	forceAllowItemActions: boolean;
	forceAllowRoomLeave: boolean;
	/** This flag disables all character modifiers - same as if they didn't satisfy their activation conditions. */
	suppressCharacterModifiers: boolean;
}>;

const INTERACTION_OVERRIDE_CONFIG = {
	normal: {
		allowLeaveAt: 0,
		blockInteractions: false,
		forceAllowItemActions: false,
		forceAllowRoomLeave: false,
		suppressCharacterModifiers: false,
	},
	safemode: {
		allowLeaveAt: 60 * 60_000,
		blockInteractions: true,
		forceAllowItemActions: true,
		forceAllowRoomLeave: true,
		suppressCharacterModifiers: true,
	},
	timeout: {
		allowLeaveAt: 0,
		blockInteractions: true,
		forceAllowItemActions: false,
		forceAllowRoomLeave: false,
		suppressCharacterModifiers: false,
	},
} as const satisfies Readonly<Record<RestrictionOverride['type'] | 'normal', RestrictionOverrideConfig>>;

export function GetRestrictionOverrideConfig(type?: RestrictionOverride['type'] | RestrictionOverride): RestrictionOverrideConfig {
	if (type == null)
		return INTERACTION_OVERRIDE_CONFIG.normal;
	if (typeof type === 'string')
		return INTERACTION_OVERRIDE_CONFIG[type];

	return INTERACTION_OVERRIDE_CONFIG[type.type];
}

export const AppearanceBundleSchema = z.object({
	requestedPose: AppearancePoseSchema.catch(() => GetDefaultAppearancePose()),
	items: AppearanceItemsBundleSchema,
	restrictionOverride: RestrictionOverrideSchema.optional().catch(undefined),
	attemptingAction: CharacterActionAttemptSchema.optional().catch(undefined),
	clientOnly: z.boolean().optional(),
});
export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;
export type AppearanceClientBundle = AppearanceBundle & { clientOnly: true; };

export const AppearanceClientDeltaBundleSchema = z.object({
	requestedPose: PartialAppearancePoseSchema.optional(),
	items: AppearanceItemsDeltaBundleSchema.optional(),
	restrictionOverride: RestrictionOverrideSchema.nullable().optional(),
	attemptingAction: CharacterActionAttemptSchema.nullable().optional(),
});
export type AppearanceClientDeltaBundle = z.infer<typeof AppearanceClientDeltaBundleSchema>;

export function GetDefaultAppearanceBundle(): AppearanceBundle {
	return {
		items: [],
		requestedPose: GetDefaultAppearancePose(),
	};
}
