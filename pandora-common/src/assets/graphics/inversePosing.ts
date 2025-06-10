import { z } from 'zod';
import { BoneNameSchema } from './conditions.ts';
import { TransformDefinitionSchema } from './points.ts';

/** A UI handle used for inverse kinematic posing of the character. */
export const InversePosingHandleSchema = z.object({
	/** The bone this handle is parrented to. The affected bones are this bone and all transitive parents. */
	parentBone: BoneNameSchema,
	/** Position of the handle (X coordinate) */
	x: z.number(),
	/** Position of the handle (Y coordinate) */
	y: z.number(),
	/** How should the handle be drawn. */
	style: z.enum(['left-right', 'up-down', 'move']),
	/** Optional transforms applied to the position before using it any further. */
	transforms: TransformDefinitionSchema.array().optional(),
	/**
	 * Whether this handle should ignore character rotation and scale transforms. Useful if it is meant to manipulate exactly those.
	 * @default false
	 */
	excludeFromCharacterTransforms: z.boolean().optional(),
});
/** A UI handle used for inverse kinematic posing of the character. */
export type InversePosingHandle = z.infer<typeof InversePosingHandleSchema>;
