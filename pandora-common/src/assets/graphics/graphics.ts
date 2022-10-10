import { z } from 'zod';
import { BoneNameSchema } from '../appearance';
import type { AssetId } from '../definitions';

export const CoordinatesSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const CoordinatesCompressedSchema = z.tuple([CoordinatesSchema.shape.x, CoordinatesSchema.shape.y]);
export type CoordinatesCompressed = z.infer<typeof CoordinatesCompressedSchema>;

export type BoneType = 'pose' | 'body';

export const SizeSchema = z.object({
	width: z.number(),
	height: z.number(),
});
export type Size = z.infer<typeof SizeSchema>;

export const CharacterSize = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	WIDTH: 1000,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	HEIGHT: 1500,
} as const;

export const RectangleSchema = CoordinatesSchema.merge(SizeSchema);
export type Rectangle = z.infer<typeof RectangleSchema>;

export const CONDITION_OPERATORS = ['=', '<', '<=', '>', '>=', '!='] as const;
export const ConditionOperatorSchema = z.enum(CONDITION_OPERATORS);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const AtomicConditionBoneSchema = z.object({
	bone: z.string(),
	operator: ConditionOperatorSchema,
	value: z.number(),
});
export type AtomicConditionBone = z.infer<typeof AtomicConditionBoneSchema>;
export const AtomicConditionModuleSchema = z.object({
	module: z.string(),
	operator: ConditionOperatorSchema,
	value: z.string(),
});

export const AtomicConditionSchema = z.union([
	AtomicConditionBoneSchema,
	AtomicConditionModuleSchema,
]);
export type AtomicCondition = z.infer<typeof AtomicConditionSchema>;

export const ConditionSchema = z.array(z.array(AtomicConditionSchema));
export type Condition = z.infer<typeof ConditionSchema>;

const TransformDefinitionBaseSchema = z.object({
	bone: z.string(),
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
	'BELOW_BODY',
	'BODY',
	'BELOW_BREASTS',
	'BREASTS',
	'ABOVE_BODY',
	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'BELOW_ARMS',
	'ARMS',
	'ABOVE_ARMS',
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
	colorizationIndex: z.number().int().nonnegative().optional(),

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
