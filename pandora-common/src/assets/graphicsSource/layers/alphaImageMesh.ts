import * as z from 'zod';
import { RectangleSchema } from '../../graphics/common.ts';
import { BoneNameSchema, ConditionSchema } from '../../graphics/conditions.ts';
import { LayerImageSettingSchema, LayerMirrorSchema, LayerPrioritySchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceAlphaImageMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('alphaImageMesh'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	name: z.string(),
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
