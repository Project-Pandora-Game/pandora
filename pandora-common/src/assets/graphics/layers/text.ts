import * as z from 'zod';
import { RectangleSchema } from '../common.ts';
import { LayerPrioritySchema } from './common.ts';

export const GraphicsTextLayerSchema = RectangleSchema.extend({
	type: z.literal('text'),
	priority: LayerPrioritySchema,
	angle: z.number(),
	dataModule: z.string(),
	followBone: z.string().nullable(),
	fontSize: z.number(),
	colorizationKey: z.string().optional(),
}).strict();
export type GraphicsTextLayer = z.infer<typeof GraphicsTextLayerSchema>;
