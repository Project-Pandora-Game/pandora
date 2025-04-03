import { z } from 'zod';
import { ZodBase64Regex } from '../../../validation.ts';
import { RectangleSchema } from '../common.ts';
import { BoneNameSchema } from '../conditions.ts';
import { LayerImageSettingSchema, LayerPrioritySchema } from './common.ts';

export const GraphicsAlphaImageMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('alphaImageMesh'),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.string().array().optional(),
	pointFilterMask: z.string().regex(ZodBase64Regex).optional(),

	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type GraphicsAlphaImageMeshLayer = z.infer<typeof GraphicsAlphaImageMeshLayerSchema>;
