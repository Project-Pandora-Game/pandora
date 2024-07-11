import type { Immutable } from 'immer';
import { z } from 'zod';
import { AssertNever, CloneDeepMutable } from '../../utility';
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
/**
 * Creates a copy of the transform definition in a monomorphic form
 * @param def - The definition to canonize
 */
export function CanonizeTransformDefinition(def: Immutable<TransformDefinition>): TransformDefinition {
	switch (def.type) {
		case 'rotate':
			return {
				type: def.type,
				bone: def.bone,
				value: def.value,
				condition: CloneDeepMutable(def.condition),
			};
		case 'shift':
			return {
				type: def.type,
				bone: def.bone,
				value: def.value,
				condition: CloneDeepMutable(def.condition),
			};
		case 'const-rotate':
			return {
				type: def.type,
				bone: def.bone,
				value: def.value,
				condition: CloneDeepMutable(def.condition),
			};
		case 'const-shift':
			return {
				type: def.type,
				value: def.value,
				condition: CloneDeepMutable(def.condition),
			};
	}
	AssertNever(def);
}

export const PointDefinitionSchema = z.object({
	pos: CoordinatesCompressedSchema,
	transforms: z.array(TransformDefinitionSchema),
	mirror: z.boolean(),
	pointType: z.string().optional(),
});
export type PointDefinition = z.infer<typeof PointDefinitionSchema>;
/**
 * Creates a copy of the definition in a monomorphic form
 * @param def - The definition to canonize
 */
export function CanonizePointDefinition(def: Immutable<PointDefinition>): PointDefinition {
	return {
		pos: [def.pos[0], def.pos[1]],
		mirror: def.mirror,
		pointType: def.pointType,
		transforms: def.transforms.map(CanonizeTransformDefinition),
	};
}

export const PointTemplateSchema = z.array(PointDefinitionSchema);
export type PointTemplate = z.infer<typeof PointTemplateSchema>;
/**
 * Creates a copy of the template in a monomorphic form
 * @param template - The template to canonize
 */
export function CanonizePointTemplate(template: Immutable<PointTemplate>): PointTemplate {
	return template.map(CanonizePointDefinition);
}
