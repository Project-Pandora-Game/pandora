import * as z from 'zod';
import { RectangleSchema } from '../common.ts';
import { ConditionSchema } from '../conditions.ts';
import { LayerPrioritySchema } from './common.ts';

export const GraphicsTextLayerSchema = RectangleSchema.extend({
	type: z.literal('text'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	priority: LayerPrioritySchema,
	angle: z.number(),
	dataModule: z.string(),
	followBone: z.string().nullable(),
	fontSize: z.number(),
	colorizationKey: z.string().optional(),
}).strict();
export type GraphicsTextLayer = z.infer<typeof GraphicsTextLayerSchema>;
