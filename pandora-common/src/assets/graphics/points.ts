import type { Immutable } from 'immer';
import { z } from 'zod';
import { CoordinatesCompressedSchema, CoordinatesSchema } from './common.ts';
import { BoneNameSchema, ConditionSchema } from './conditions.ts';

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

export const PointTemplateSourceSchema = z.object({
	points: PointTemplateSchema,
});
export type PointTemplateSource = z.infer<typeof PointTemplateSourceSchema>;

export function PointMatchesPointType({ pointType }: Immutable<PointDefinition>, pointTypes?: readonly string[]): boolean {
	// If point has no type, include it
	return !pointType ||
		// If there is no requirement on point types, include all
		!pointTypes ||
		// If the point type is included exactly, include it
		pointTypes.includes(pointType) ||
		// If the point type doesn't have side, include it if wanted types have sided one
		!(/_[lr]$/.exec(pointType)) && (
			pointTypes.includes(pointType + '_r') ||
			pointTypes.includes(pointType + '_l')
		) ||
		// If the point type has side, indide it if wanted types have base one
		pointTypes.includes(pointType.replace(/_[lr]$/, ''));
}
