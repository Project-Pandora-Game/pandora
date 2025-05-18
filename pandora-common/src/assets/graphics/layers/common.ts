import { z } from 'zod';
import { BoneNameSchema, ConditionSchema } from '../conditions.ts';

export const LayerImageOverrideSchema = z.object({
	image: z.string(),
	/**
	 * Pose to use for calculating UV coordinates of vertices.
	 *
	 * EXPERIMENTAL - subject to change, will likely be merged with `scaling` options soon.
	 */
	uvPose: z.record(BoneNameSchema, z.number()).optional(),
	condition: ConditionSchema,
});
export type LayerImageOverride = z.infer<typeof LayerImageOverrideSchema>;

export const LAYER_PRIORITIES = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',

	'BELOW_BODY_SOLES',
	'BODY_SOLES',
	'BELOW_BODY',

	'BELOW_LEG_LEFT',
	'LEG_LEFT',
	'ABOVE_LEG_LEFT',

	'BELOW_LEG_RIGHT',
	'LEG_RIGHT',
	'ABOVE_LEG_RIGHT',

	'BODY',
	'BELOW_BREASTS',
	'BREASTS',
	'ABOVE_BODY',

	'BELOW_ARM_LEFT',
	'ARM_LEFT',
	'ABOVE_ARM_LEFT',

	'BELOW_ARM_RIGHT',
	'ARM_RIGHT',
	'ABOVE_ARM_RIGHT',

	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'OVERLAY',
] as const;

// Some priority layers should get mirrored when layer get mirrored
export const PRIORITY_ORDER_MIRROR: Partial<Record<LayerPriority, LayerPriority>> = {
	BELOW_ARM_LEFT: 'BELOW_ARM_RIGHT',
	BELOW_ARM_RIGHT: 'BELOW_ARM_LEFT',

	ARM_LEFT: 'ARM_RIGHT',
	ARM_RIGHT: 'ARM_LEFT',

	ABOVE_ARM_LEFT: 'ABOVE_ARM_RIGHT',
	ABOVE_ARM_RIGHT: 'ABOVE_ARM_LEFT',

	BELOW_LEG_LEFT: 'BELOW_LEG_RIGHT',
	BELOW_LEG_RIGHT: 'BELOW_LEG_LEFT',

	LEG_LEFT: 'LEG_RIGHT',
	LEG_RIGHT: 'LEG_LEFT',

	ABOVE_LEG_LEFT: 'ABOVE_LEG_RIGHT',
	ABOVE_LEG_RIGHT: 'ABOVE_LEG_LEFT',
};
if (!(Object.entries(PRIORITY_ORDER_MIRROR)).every(([original, mirror]) => PRIORITY_ORDER_MIRROR[mirror] === original)) {
	throw new Error('PRIORITY_ORDER_MIRROR not valid');
}

export const LayerPrioritySchema = z.enum(LAYER_PRIORITIES);
export type LayerPriority = z.infer<typeof LayerPrioritySchema>;

export enum LayerMirror {
	NONE,
	/** Only imageOverrides are mirrored, points are selected */
	SELECT,
}
export const LayerMirrorSchema = z.nativeEnum(LayerMirror);

export enum LayerSide {
	LEFT,
	RIGHT,
}

export const LayerImageSettingSchema = z.object({
	image: z.string(),
	/**
	 * Pose to use for calculating UV coordinates of vertices.
	 *
	 * EXPERIMENTAL - subject to change, will likely be merged with `scaling` options soon.
	 */
	uvPose: z.record(BoneNameSchema, z.number()).optional(),
	overrides: z.array(LayerImageOverrideSchema),
}).strict();
export type LayerImageSetting = z.infer<typeof LayerImageSettingSchema>;

export const LayerStateOverridesSchema = z.object({
	color: z.number().optional(),
	alpha: z.number().optional(),
});
export type LayerStateOverrides = z.infer<typeof LayerStateOverridesSchema>;

export function MirrorPriority(priority: LayerPriority): LayerPriority {
	const mirrorPriority = PRIORITY_ORDER_MIRROR[priority];
	return mirrorPriority != null ? mirrorPriority : priority;
}
