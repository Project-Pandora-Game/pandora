import { z } from 'zod';
import { CoordinatesCompressedSchema, CoordinatesSchema } from './common.ts';
import { BoneNameSchema, ConditionSchema } from './conditions.ts';
import { LayerPrioritySchema, type LayerPriority } from './layers/common.ts';

export const TransformDefinitionSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('rotate'),
		bone: BoneNameSchema,
		value: z.number(),
		condition: ConditionSchema.optional(),
	}),
	z.object({
		type: z.literal('shift'),
		bone: BoneNameSchema,
		value: CoordinatesSchema,
		condition: ConditionSchema.optional(),
	}),
	z.object({
		type: z.literal('const-rotate'),
		bone: BoneNameSchema,
		value: z.number(),
		condition: ConditionSchema.optional(),
	}),
	z.object({
		type: z.literal('const-shift'),
		value: CoordinatesSchema,
		condition: ConditionSchema.optional(),
	}),
]);
export type TransformDefinition = z.infer<typeof TransformDefinitionSchema>;

export const PointDefinitionSchema = z.object({
	pos: CoordinatesCompressedSchema,
	mirror: z.boolean(),
	pointType: z.string().optional(),
	transforms: TransformDefinitionSchema.array(),
});
export type PointDefinition = z.infer<typeof PointDefinitionSchema>;

export const PointTemplateSchema = z.array(PointDefinitionSchema);
export type PointTemplate = z.infer<typeof PointTemplateSchema>;

export const PointTemplateSourcePointTypeDataSchema = z.object({
	/** Which priorities this point type can be used on, or '*' if on any priority. */
	allowedPriorities: LayerPrioritySchema.array().or(z.literal('*')),
});
/** List of priorities that any point can use, even if its point type metadata doesn't allow it otherwise. */
export const ALWAYS_ALLOWED_LAYER_PRIORITIES: readonly LayerPriority[] = [
	'BACKGROUND',
	'OVERLAY',
];

export const PointTemplateSourceSchema = z.object({
	pointTypes: z.record(z.string(), PointTemplateSourcePointTypeDataSchema).default({}),
	points: PointTemplateSchema,
});
export type PointTemplateSource = z.infer<typeof PointTemplateSourceSchema>;

export function PointTypeMatchesPointTypeFilter(pointType: string | undefined, pointTypesFilter?: readonly string[]): boolean {
	// If point has no type, include it
	return !pointType ||
		// If there is no requirement on point types, include all
		!pointTypesFilter ||
		// If the point type is included exactly, include it
		pointTypesFilter.includes(pointType) ||
		// If the point type doesn't have side, include it if wanted types have sided one
		!(/_[lr]$/.test(pointType)) && (
			pointTypesFilter.includes(pointType + '_r') ||
			pointTypesFilter.includes(pointType + '_l')
		) ||
		// If the point type has side, include it if wanted types have base one
		pointTypesFilter.includes(pointType.replace(/_[lr]$/, ''));
}
