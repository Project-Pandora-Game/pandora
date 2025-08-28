import * as z from 'zod';
import { ZodBase64Regex } from '../../../validation.ts';
import { RectangleSchema } from '../common.ts';
import { BoneNameSchema } from '../conditions.ts';
import { LayerImageSettingSchema, LayerNormalDataSchema, LayerPrioritySchema, LayerStateOverridesSchema } from './common.ts';

export const GraphicsMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('mesh'),
	priority: LayerPrioritySchema,
	points: z.string(),
	pointType: z.string().array().optional(),
	pointFilterMask: z.string().regex(ZodBase64Regex).optional(),
	/** Overrides applied to this layer while generating an item preview. */
	previewOverrides: LayerStateOverridesSchema.optional(),
	colorizationKey: z.string().optional(),

	normalMap: LayerNormalDataSchema.optional(),
	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type GraphicsMeshLayer = z.infer<typeof GraphicsMeshLayerSchema>;
