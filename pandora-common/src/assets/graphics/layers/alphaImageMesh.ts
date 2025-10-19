import * as z from 'zod';
import { ZodBase64Regex } from '../../../validation.ts';
import { RectangleSchema } from '../common.ts';
import { LayerImageSettingSchema, LayerPrioritySchema } from './common.ts';

export const GraphicsAlphaImageMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('alphaImageMesh'),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.string().array().optional(),
	pointFilterMask: z.string().regex(ZodBase64Regex).optional(),

	image: LayerImageSettingSchema,
}).strict();
export type GraphicsAlphaImageMeshLayer = z.infer<typeof GraphicsAlphaImageMeshLayerSchema>;
