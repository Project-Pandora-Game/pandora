import * as z from 'zod';
import { CoordinatesSchema, RectangleSchema } from '../common.ts';
import { ConditionSchema } from '../conditions.ts';
import { LayerImageOverrideSchema } from './common.ts';

export const RoomDeviceGraphicsLayerSpriteSchema = RectangleSchema.extend({
	type: z.literal('sprite'),
	offsetOverrides: z.object({
		offset: CoordinatesSchema,
		condition: ConditionSchema,
	}).array().optional(),
	/**
	 * Clips the graphics to the room, at the matching perspective transform depth.
	 * This is useful mainly for items that want to stop at a wall or ceiling (e.g. a chain going to ceiling), no matter how far the wall is.
	 * @default false
	 */
	clipToRoom: z.boolean().optional(),
	/** Name of colorization key used to color this sprite layer */
	colorizationKey: z.string().optional(),
	image: z.string(),
	imageOverrides: LayerImageOverrideSchema.array().optional(),
}).strict();
export type RoomDeviceGraphicsLayerSprite = z.infer<typeof RoomDeviceGraphicsLayerSpriteSchema>;
