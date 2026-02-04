import * as z from 'zod';
import { CoordinatesSchema, RectangleSchema } from '../common.ts';
import { ConditionSchema } from '../conditions.ts';
import { LayerNormalDataSchema, RoomDeviceLayerImageOverrideSchema } from './common.ts';

export const RoomDeviceGraphicsLayerSpriteSchema = RectangleSchema.extend({
	type: z.literal('sprite'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
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

	normalMap: LayerNormalDataSchema.optional(),
	image: z.string(),
	normalMapImage: z.string().optional(),
	imageOverrides: RoomDeviceLayerImageOverrideSchema.array().optional(),
}).strict();
export type RoomDeviceGraphicsLayerSprite = z.infer<typeof RoomDeviceGraphicsLayerSpriteSchema>;
