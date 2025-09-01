import * as z from 'zod';
import { BoneNameSchema } from '../../graphics/conditions.ts';
import { RectangleSchema } from '../../graphics/common.ts';
import { LayerImageSettingSchema, LayerMirrorSchema, LayerPrioritySchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceAlphaImageMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('alphaImageMesh'),
	name: z.string().default(''),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.string().array().optional(),
	mirror: LayerMirrorSchema,

	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type GraphicsSourceAlphaImageMeshLayer = z.infer<typeof GraphicsSourceAlphaImageMeshLayerSchema>;
