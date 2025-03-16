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
