import { z } from 'zod';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { ItemBundleSchema } from '../item/unified';
import { AppearancePoseSchema, GetDefaultAppearancePose } from './characterStatePose';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

export const RestrictionOverrideSchema = z.object({
	type: z.enum(['safemode', 'timeout']),
	allowLeaveAt: z.number(),
});
export type RestrictionOverride = Readonly<z.infer<typeof RestrictionOverrideSchema>>;

export type RestrictionOverrideConfig = Readonly<{
	allowLeaveAt: number;
	blockInteractions: boolean;
	forceAllowItemActions: boolean;
	forceAllowRoomLeave: boolean;
}>;

const INTERACTION_OVERRIDE_CONFIG = {
	normal: {
		allowLeaveAt: 0,
		blockInteractions: false,
		forceAllowItemActions: false,
		forceAllowRoomLeave: false,
	},
	safemode: {
		allowLeaveAt: 60 * 60_000,
		blockInteractions: true,
		forceAllowItemActions: true,
		forceAllowRoomLeave: true,
	},
	timeout: {
		allowLeaveAt: 0,
		blockInteractions: true,
		forceAllowItemActions: false,
		forceAllowRoomLeave: false,
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
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	restrictionOverride: RestrictionOverrideSchema.optional().catch(() => undefined),
	clientOnly: z.boolean().optional(),
});
export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;
export type AppearanceClientBundle = AppearanceBundle & { clientOnly: true; };

export function GetDefaultAppearanceBundle(): AppearanceBundle {
	return {
		items: [],
		requestedPose: GetDefaultAppearancePose(),
	};
}
