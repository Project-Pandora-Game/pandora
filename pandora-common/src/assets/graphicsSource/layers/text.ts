import { z } from 'zod';
import { RectangleSchema } from '../../graphics/common.ts';
import { LayerPrioritySchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceTextLayerSchema = RectangleSchema.extend({
	type: z.literal('text'),
	name: z.string().default(''),
	priority: LayerPrioritySchema,
	angle: z.number(),
	dataModule: z.string(),
	followBone: z.string().nullable(),
	fontSize: z.number(),
	colorizationKey: z.string().optional(),
}).strict();
export type GraphicsSourceTextLayer = z.infer<typeof GraphicsSourceTextLayerSchema>;
