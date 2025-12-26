import * as z from 'zod';
import { CoordinatesSchema, RectangleSchema } from '../../graphics/common.ts';
import { ConditionSchema } from '../../graphics/conditions.ts';
import { LayerImageOverrideSchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceRoomDeviceLayerSpriteSchema = RectangleSchema.extend({
	type: z.literal('sprite'),
	name: z.string().optional(),
	/**
	 * Offset of this sprite relative to cage's origin point
	 * @default { x: 0, y: 0 }
	 */
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
export type GraphicsSourceRoomDeviceLayerSprite = z.infer<typeof GraphicsSourceRoomDeviceLayerSpriteSchema>;
