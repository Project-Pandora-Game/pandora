import type { ArrayCompressType } from '../../utility';
import { CreateArrayValidator, CreateMaybeValidator, CreateObjectValidator, CreateOneOfValidator, CreateTupleValidator, CreateUnionValidator, IsBoolean, IsNumber, IsString } from '../../validation';
import type { AssetId } from '../definitions';

export type Coordinates = { x: number, y: number; };
export const IsCoordinates = CreateObjectValidator<Coordinates>({ x: IsNumber, y: IsNumber });

export type CoordinatesCompressed = ArrayCompressType<Coordinates, ['x', 'y']>;
export const IsCoordinatesCompressed = CreateTupleValidator<CoordinatesCompressed>(IsNumber, IsNumber);

export type Size = { width: number, height: number; };

export const CharacterSize = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	WIDTH: 1000,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	HEIGHT: 1500,
} as const;

export type Rectangle = Coordinates & Size;

export const CONDITION_OPERATORS = ['=', '<', '<=', '>', '>=', '!='] as const;
export type ConditionOperator = string & (typeof CONDITION_OPERATORS)[number];
export const IsConditionOperator = CreateOneOfValidator<ConditionOperator>(...CONDITION_OPERATORS);

export interface AtomicCondition {
	bone: string;
	operator: ConditionOperator;
	value: number;
}
export const IsAtomicCondition = CreateObjectValidator<AtomicCondition>({
	bone: IsString,
	operator: IsConditionOperator,
	value: IsNumber,
});

export type Condition = AtomicCondition[][];
export const IsCondition = CreateArrayValidator({ validator: CreateArrayValidator({ validator: IsAtomicCondition }) });

export type TransformDefinition = { bone: string; condition?: Condition; } & ({
	type: 'rotate';
	value: number;
} | {
	type: 'shift';
	value: Coordinates;
});
export const IsTransformDefinition = CreateUnionValidator<TransformDefinition>(
	CreateObjectValidator({
		bone: IsString,
		condition: CreateMaybeValidator(IsCondition),
		type: CreateOneOfValidator('rotate'),
		value: IsNumber,
	}),
	CreateObjectValidator({
		bone: IsString,
		condition: CreateMaybeValidator(IsCondition),
		type: CreateOneOfValidator('shift'),
		value: IsCoordinates,
	}),
);

export interface BoneDefinition {
	name: string;
	x: number;
	y: number;
	baseRotation?: number;
	mirror?: BoneDefinition;
	isMirror: boolean;
	parent?: BoneDefinition;
}

export interface BoneState {
	readonly definition: BoneDefinition;
	readonly rotation: number;
}

export interface PointDefinition {
	pos: CoordinatesCompressed;
	transforms: TransformDefinition[];
	mirror: boolean;
	pointType?: string;
}
export const IsPointDefinition = CreateObjectValidator<PointDefinition>({
	pos: IsCoordinatesCompressed,
	transforms: CreateArrayValidator({ validator: IsTransformDefinition }),
	mirror: IsBoolean,
	pointType: CreateMaybeValidator(IsString),
});

export type LayerImageOverride = { image: string; condition: Condition; };
export const IsLayerImageOverride = CreateObjectValidator<LayerImageOverride>({
	image: IsString,
	condition: IsCondition,
});

export const LAYER_PRIORITIES = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY',
	'BODY',
	'ABOVE_BODY',
	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'BELOW_ARMS',
	'ARMS',
	'ABOVE_ARMS',
	'OVERLAY',
] as const;

export type LayerPriority = string & (typeof LAYER_PRIORITIES)[number];
export const IsLayerPriority = CreateOneOfValidator<LayerPriority>(...LAYER_PRIORITIES);

export const enum LayerMirror {
	NONE,
	/** Only imageOverrides are mirrored, points are selected */
	SELECT,
	/** Mirrors everything and creates the mirrored image */
	FULL,
}
export const IsLayerMirror = CreateOneOfValidator<LayerMirror>(LayerMirror.NONE, LayerMirror.SELECT, LayerMirror.FULL);

export const enum LayerSide {
	LEFT,
	RIGHT,
}

export type LayerDefinition = Rectangle & {
	name?: string;
	image: string;
	priority: LayerPriority;
	points: PointDefinition[] | number;
	imageOverrides: LayerImageOverride[];
	pointType?: string[];
	mirror: LayerMirror;
};
export const IsLayerDefinition = CreateObjectValidator<LayerDefinition>({
	// Rectangle
	x: IsNumber,
	y: IsNumber,
	height: IsNumber,
	width: IsNumber,
	// LayerDefinition
	name: CreateMaybeValidator(IsString),
	image: IsString,
	priority: IsLayerPriority,
	points: CreateUnionValidator<PointDefinition[] | number>(CreateArrayValidator({ validator: IsPointDefinition }), IsNumber),
	imageOverrides: CreateArrayValidator({ validator: IsLayerImageOverride }),
	pointType: CreateMaybeValidator(CreateArrayValidator({ validator: IsString })),
	mirror: IsLayerMirror,
});

export type AssetGraphicsDefinition = {
	layers: LayerDefinition[];
};
export const IsAssetGraphicsDefinition = CreateObjectValidator<AssetGraphicsDefinition>({
	layers: CreateArrayValidator({ validator: IsLayerDefinition }),
}, { noExtraKey: true });

export interface AssetsGraphicsDefinitionFile {
	assets: Record<AssetId, AssetGraphicsDefinition>;
}
