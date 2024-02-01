import { z } from 'zod';
import type { AssetId } from '../base';
import { ZodOverridable } from '../../validation';

export const CoordinatesSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const CoordinatesCompressedSchema = z.tuple([CoordinatesSchema.shape.x, CoordinatesSchema.shape.y]);
export type CoordinatesCompressed = z.infer<typeof CoordinatesCompressedSchema>;

export const BoneNameSchema = ZodOverridable(z.string());
export type BoneName = z.infer<typeof BoneNameSchema>;

export type BoneType = 'pose' | 'body';

export const SizeSchema = z.object({
	width: z.number(),
	height: z.number(),
});
export type Size = z.infer<typeof SizeSchema>;

export const CharacterSize = {
	WIDTH: 1000,
	HEIGHT: 1500,
} as const;

export const CharacterViewSchema = z.enum(['front', 'back']);
export type CharacterView = z.infer<typeof CharacterViewSchema>;

export const ArmPoseSchema = z.enum(['front', 'back']);
export type ArmPose = z.infer<typeof ArmPoseSchema>;

export const ArmRotationSchema = z.enum(['up', 'down', 'forward', 'backward']);
export type ArmRotation = z.infer<typeof ArmRotationSchema>;

export const ArmFingersSchema = z.enum(['spread', 'fist']);
export type ArmFingers = z.infer<typeof ArmFingersSchema>;

export const LegsPoseSchema = z.enum(['standing', 'sitting', 'kneeling']);
export type LegsPose = z.infer<typeof LegsPoseSchema>;

export const RectangleSchema = CoordinatesSchema.merge(SizeSchema);
export type Rectangle = z.infer<typeof RectangleSchema>;

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
export const AtomicConditionSchema = z.union([
	AtomicConditionBoneSchema,
	AtomicConditionModuleSchema,
	AtomicConditionAttributeSchema,
	AtomicConditionArmRotationSchema,
	AtomicConditionArmFingersSchema,
	AtomicConditionLegsSchema,
	AtomicConditionViewSchema,
]);
export type AtomicCondition = z.infer<typeof AtomicConditionSchema>;

export const ConditionSchema = z.array(z.array(AtomicConditionSchema));
export type Condition = z.infer<typeof ConditionSchema>;

const TransformDefinitionBaseSchema = z.object({
	bone: BoneNameSchema,
	condition: ConditionSchema.optional(),
});

export const TransformDefinitionSchema = z.discriminatedUnion('type', [
	TransformDefinitionBaseSchema.extend({
		type: z.literal('rotate'),
		value: z.number(),
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('shift'),
		value: CoordinatesSchema,
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('const-rotate'),
		value: z.number(),
	}),
	TransformDefinitionBaseSchema.extend({
		type: z.literal('const-shift'),
		value: CoordinatesSchema,
	}).omit({ bone: true }),
]);
export type TransformDefinition = z.infer<typeof TransformDefinitionSchema>;

export interface BoneDefinition {
	name: string;
	x: number;
	y: number;
	baseRotation?: number;
	mirror?: BoneDefinition;
	isMirror: boolean;
	parent?: BoneDefinition;
	type: BoneType;
}

export interface BoneState {
	readonly definition: BoneDefinition;
	readonly rotation: number;
}

export const PointDefinitionSchema = z.object({
	pos: CoordinatesCompressedSchema,
	transforms: z.array(TransformDefinitionSchema),
	mirror: z.boolean(),
	pointType: z.string().optional(),
});
export type PointDefinition = z.infer<typeof PointDefinitionSchema>;

export const PointTemplateSchema = z.array(PointDefinitionSchema);
export type PointTemplate = z.infer<typeof PointTemplateSchema>;

export const LayerImageOverrideSchema = z.object({
	image: z.string(),
	condition: ConditionSchema,
});
export type LayerImageOverride = z.infer<typeof LayerImageOverrideSchema>;

export const LAYER_PRIORITIES = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',

	'BELOW_BODY_SOLES',
	'BODY_SOLES',
	'BELOW_BODY',
	'BODY',
	'BELOW_BREASTS',
	'BREASTS',
	'ABOVE_BODY',

	'BELOW_ARM_LEFT',
	'ARM_LEFT',
	'ABOVE_ARM_LEFT',

	'BELOW_ARM_RIGHT',
	'ARM_RIGHT',
	'ABOVE_ARM_RIGHT',

	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'OVERLAY',
] as const;

export const LayerPrioritySchema = z.enum(LAYER_PRIORITIES);
export type LayerPriority = z.infer<typeof LayerPrioritySchema>;

export enum LayerMirror {
	NONE,
	/** Only imageOverrides are mirrored, points are selected */
	SELECT,
	/** Mirrors everything and creates the mirrored image */
	FULL,
}
export const LayerMirrorSchema = z.nativeEnum(LayerMirror);

export enum LayerSide {
	LEFT,
	RIGHT,
}

export const LayerImageSettingSchema = z.object({
	image: z.string(),
	overrides: z.array(LayerImageOverrideSchema),
	alphaImage: z.string().min(1).optional(),
	alphaOverrides: z.array(LayerImageOverrideSchema).min(1).optional(),
}).strict();
export type LayerImageSetting = z.infer<typeof LayerImageSettingSchema>;

export const LayerDefinitionSchema = RectangleSchema.extend({
	name: z.string().optional(),
	priority: LayerPrioritySchema,
	points: z.union([z.array(PointDefinitionSchema), z.string(), z.number()]),
	pointType: z.array(z.string()).optional(),
	mirror: LayerMirrorSchema,
	colorizationKey: z.string().optional(),

	image: LayerImageSettingSchema,
	scaling: z.object({
		scaleBone: BoneNameSchema,
		stops: z.array(z.tuple([z.number(), LayerImageSettingSchema])),
	}).optional(),
}).strict();
export type LayerDefinition = z.infer<typeof LayerDefinitionSchema>;

export const AssetGraphicsDefinitionSchema = z.object({
	layers: z.array(LayerDefinitionSchema),
}).strict();
export type AssetGraphicsDefinition = z.infer<typeof AssetGraphicsDefinitionSchema>;

export interface AssetsGraphicsDefinitionFile {
	assets: Record<AssetId, AssetGraphicsDefinition>;
	pointTemplates: Record<string, PointTemplate>;
}
