import * as z from 'zod';
import { ZodWrapInternString } from '../../validation.ts';
import { GraphicsSourceAutoMeshTemplateSchema } from '../graphicsSource/layers/autoMesh.ts';
import { CoordinatesCompressedSchema, CoordinatesSchema } from './common.ts';
import { BoneNameSchema, PoseConditionSchema } from './conditions.ts';
import { LayerPrioritySchema, type LayerPriority } from './layers/common.ts';

export const TransformDefinitionSchema = z.discriminatedUnion('type', [
	z.object({
		type: ZodWrapInternString(z.literal('rotate')),
		bone: BoneNameSchema,
		value: z.number(),
		condition: PoseConditionSchema.optional(),
	}),
	z.object({
		type: ZodWrapInternString(z.literal('shift')),
		bone: BoneNameSchema,
		value: CoordinatesSchema,
		condition: PoseConditionSchema.optional(),
	}),
	z.object({
		type: ZodWrapInternString(z.literal('const-shift')),
		value: CoordinatesSchema,
		condition: PoseConditionSchema.optional(),
	}),
]);
export type TransformDefinition = z.infer<typeof TransformDefinitionSchema>;

export const PointSkinningEntrySchema = z.object({
	/** Name of a bone to use for skinning. */
	bone: BoneNameSchema,
	/** The weight of this bone. All weights should add up to 1 or less, otherwise things might break. Remaining weight will be filled with identity transform. */
	weight: z.number(),
});
export type PointSkinningEntry = z.infer<typeof PointSkinningEntrySchema>;
export const PointSkinningDefinitionSchema = PointSkinningEntrySchema.array().max(4);
export type PointSkinningDefinition = z.infer<typeof PointSkinningDefinitionSchema>;

export const PointDefinitionSchema = z.object({
	pos: CoordinatesCompressedSchema,
	mirror: z.boolean(),
	pointType: z.string(),
	transforms: TransformDefinitionSchema.array(),
	skinning: PointSkinningDefinitionSchema.optional(),
});
export type PointDefinition = z.infer<typeof PointDefinitionSchema>;

export const PointTemplateSchema = z.array(PointDefinitionSchema);
export type PointTemplate = z.infer<typeof PointTemplateSchema>;

export const PointTemplateSourcePointTypeDataSchema = z.object({
	/** Which priorities this point type can be used on, or '*' if on any priority. */
	allowedPriorities: LayerPrioritySchema.array().or(z.literal('*')),
	/** List of point types that should be included if this one is. */
	requiredPointTypes: z.string().array().optional(),
});
/** List of priorities that any point can use, even if its point type metadata doesn't allow it otherwise. */
export const ALWAYS_ALLOWED_LAYER_PRIORITIES: readonly LayerPriority[] = [
	'BACKGROUND',
	'OVERLAY',
];

export const PointTemplateSourceSchema = z.object({
	pointTypes: z.record(z.string(), PointTemplateSourcePointTypeDataSchema),
	automeshTemplates: z.record(z.string(), GraphicsSourceAutoMeshTemplateSchema).optional(),
	points: PointTemplateSchema,
});
export type PointTemplateSource = z.infer<typeof PointTemplateSourceSchema>;
