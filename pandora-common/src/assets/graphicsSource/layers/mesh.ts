import { z } from 'zod';
import { RectangleSchema } from '../../graphics/common.ts';
import { BoneNameSchema } from '../../graphics/conditions.ts';
import { LayerImageSettingSchema, LayerMirrorSchema, LayerPrioritySchema, LayerStateOverridesSchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('mesh'),
	name: z.string().default(''),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.array(z.string()).optional(),
	/** Overrides applied to this layer while generating an item preview. */
	previewOverrides: LayerStateOverridesSchema.optional(),
	mirror: LayerMirrorSchema,
	colorizationKey: z.string().optional(),

	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type GraphicsSourceMeshLayer = z.infer<typeof GraphicsSourceMeshLayerSchema>;
