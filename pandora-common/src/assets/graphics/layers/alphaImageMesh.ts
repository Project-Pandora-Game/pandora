import { z } from 'zod';
import { ZodBase64Regex } from '../../../validation.ts';
import { RectangleSchema } from '../common.ts';
import { BoneNameSchema } from '../conditions.ts';
import { LayerImageSettingSchema, LayerMirrorSchema, LayerPrioritySchema } from './common.ts';

export const GraphicsAlphaImageMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('alphaImageMesh'),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.array(z.string()).optional(),
	pointFilterMask: z.string().regex(ZodBase64Regex).optional(),
	mirror: LayerMirrorSchema,

	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type GraphicsAlphaImageMeshLayer = z.infer<typeof GraphicsAlphaImageMeshLayerSchema>;
