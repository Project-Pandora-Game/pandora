import * as z from 'zod';
import { RectangleSchema } from '../../graphics/common.ts';
import { ConditionSchema } from '../../graphics/conditions.ts';
import { LayerPrioritySchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceTextLayerSchema = RectangleSchema.extend({
	type: z.literal('text'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	name: z.string(),
	priority: LayerPrioritySchema,
	angle: z.number(),
	dataModule: z.string(),
	followBone: z.string().nullable(),
	fontSize: z.number(),
	colorizationKey: z.string().optional(),
}).strict();
export type GraphicsSourceTextLayer = z.infer<typeof GraphicsSourceTextLayerSchema>;
