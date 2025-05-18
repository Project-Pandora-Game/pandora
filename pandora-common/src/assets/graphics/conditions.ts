import { z } from 'zod';
import { ZodOverridable } from '../../validation.ts';

export const BoneNameSchema = ZodOverridable(z.string());
export type BoneName = z.infer<typeof BoneNameSchema>;

export type BoneType = 'pose' | 'body';

export const CharacterViewSchema = z.enum(['front', 'back']);
export type CharacterView = z.infer<typeof CharacterViewSchema>;

export const ArmPoseSchema = z.enum(['front_above_hair', 'front', 'back', 'back_below_hair']);
export type ArmPose = z.infer<typeof ArmPoseSchema>;

export const ArmRotationSchema = z.enum(['up', 'down', 'forward', 'backward']);
export type ArmRotation = z.infer<typeof ArmRotationSchema>;

export const ArmFingersSchema = z.enum(['spread', 'fist']);
export type ArmFingers = z.infer<typeof ArmFingersSchema>;

export const ArmSegmentOrderSchema = z.enum(['left', 'right']);
export type ArmSegmentOrder = z.infer<typeof ArmSegmentOrderSchema>;

export const LegSideOrderSchema = z.enum(['left', 'right']);
export type LegSideOrder = z.infer<typeof LegSideOrderSchema>;

export const LegsPoseSchema = z.enum(['standing', 'sitting', 'kneeling']);
export type LegsPose = z.infer<typeof LegsPoseSchema>;

export const CONDITION_OPERATORS = ['=', '<', '<=', '>', '>=', '!='] as const;
export const ConditionOperatorSchema = z.enum(CONDITION_OPERATORS);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ModuleNameSchema = ZodOverridable(z.string());
export const AttributeNameSchema = ZodOverridable(z.string());

export const AtomicConditionBoneSchema = z.object({
	bone: BoneNameSchema,
	operator: ConditionOperatorSchema,
	value: z.number(),
});
export type AtomicConditionBone = z.infer<typeof AtomicConditionBoneSchema>;
export const AtomicConditionModuleSchema = z.object({
	module: ModuleNameSchema,
	operator: ConditionOperatorSchema,
	value: z.string(),
});
export const AtomicConditionAttributeSchema = z.object({
	/**
	 * Attribute that which required for this condition to be true
	 *  - attribute can be prefixed with `!` to negate the condition
	 */
	attribute: AttributeNameSchema,
});
export const AtomicConditionArmRotationSchema = z.object({
	armType: z.literal('rotation'),
	side: z.enum(['left', 'right']),
	operator: ConditionOperatorSchema,
	value: ArmRotationSchema,
});
export const AtomicConditionArmFingersSchema = z.object({
	armType: z.literal('fingers'),
	side: z.enum(['left', 'right']),
	operator: ConditionOperatorSchema,
	value: ArmFingersSchema,
});

type Negate<T extends string> = `!${T}`;
type NegateArray<T extends string[]> = T extends [infer F extends string, ...infer R extends string[]] ? [Negate<F>, ...NegateArray<R>] : [];
function Negatable<T extends string[]>(arr: T): [...T, ...NegateArray<T>] {
	return [...arr, ...arr.map((x) => `!${x}`) as NegateArray<T>];
}

export const AtomicConditionLegsSchema = z.object({
	legs: z.enum(Negatable(LegsPoseSchema.options)),
});
export const AtomicConditionViewSchema = z.object({
	view: CharacterViewSchema,
});
export const AtomicConditionBlinkingSchema = z.object({
	blinking: z.boolean(),
});
export const AtomicConditionSchema = z.union([
	AtomicConditionBoneSchema,
	AtomicConditionModuleSchema,
	AtomicConditionAttributeSchema,
	AtomicConditionArmRotationSchema,
	AtomicConditionArmFingersSchema,
	AtomicConditionLegsSchema,
	AtomicConditionViewSchema,
	AtomicConditionBlinkingSchema,
]);
export type AtomicCondition = z.infer<typeof AtomicConditionSchema>;

export const ConditionSchema = z.array(z.array(AtomicConditionSchema));
export type Condition = z.infer<typeof ConditionSchema>;
