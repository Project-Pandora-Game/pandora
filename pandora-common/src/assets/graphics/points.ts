import { z } from 'zod';
import { CoordinatesCompressedSchema, CoordinatesSchema } from './common';
import { BoneNameSchema, ConditionSchema } from './conditions';

// Fix for pnpm resolution weirdness
import type { } from '../../validation';

const TransformDefinitionBaseSchema = z.object({
	condition: ConditionSchema.optional(),
});

export const TransformDefinitionSchema = z.discriminatedUnion('type', [
	TransformDefinitionBaseSchema.extend({
		type: z.literal('rotate'),
		value: z.number(),
		bone: BoneNameSchema,
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('shift'),
		value: CoordinatesSchema,
		bone: BoneNameSchema,
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('const-rotate'),
		value: z.number(),
		bone: BoneNameSchema,
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('const-shift'),
		value: CoordinatesSchema,
	}),
]);
export type TransformDefinition = z.infer<typeof TransformDefinitionSchema>;

export const PointDefinitionSchema = z.object({
	pos: CoordinatesCompressedSchema,
	transforms: z.array(TransformDefinitionSchema),
	mirror: z.boolean(),
	pointType: z.string().optional(),
});
export type PointDefinition = z.infer<typeof PointDefinitionSchema>;

export const PointTemplateSchema = z.array(PointDefinitionSchema);
export type PointTemplate = z.infer<typeof PointTemplateSchema>;
