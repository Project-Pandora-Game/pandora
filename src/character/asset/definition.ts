import type { ArrayCompressType } from '../../utility';

export type Coordinates = { x: number, y: number; };
export type CoordinatesCompressed = ArrayCompressType<Coordinates, ['x', 'y']>;

export type Size = { width: number, height: number; };
export type SizeCompressed = ArrayCompressType<Size, ['width', 'height']>;

export type Rectangle = Coordinates & Size;
export type RectangleCompressed = [...CoordinatesCompressed, ...SizeCompressed];

export type ConditionOperator = '=' | '<' | '<=' | '>' | '>=' | '!=';
export interface AtomicCondition {
	bone: string;
	operator: ConditionOperator;
	value: number;
}
export type AtomicConditionCompressed = ArrayCompressType<AtomicCondition, ['bone', 'operator', 'value']>;

export type Condition = AtomicCondition[][];
export type ConditionCompressed = AtomicConditionCompressed[][];

export type TransformDefinition = { bone: string; condition?: Condition; } & ({
	type: 'rotate';
	value: number;
} | {
	type: 'shift';
	value: Coordinates;
});
export type TransformDefinitionCompressed =
	['rotate', string, number, ConditionCompressed?] |
	['shift', string, CoordinatesCompressed, ConditionCompressed?];

export interface BoneDefinition {
	name: string;
	x: number;
	y: number;
	rotation: number;
	mirror?: BoneDefinition;
	parent?: BoneDefinition;
}
export interface BoneDefinitionCompressed {
	name: string;
	pos?: CoordinatesCompressed;
	mirror?: string;
	parent?: string;
	rotation?: number;
}

export interface PointDefinition {
	pos: CoordinatesCompressed;
	transforms: TransformDefinition[];
	mirror: boolean;
	pointType?: string;
}
export type PointDefinitionCompressed = {
	pos: CoordinatesCompressed;
	transforms?: TransformDefinitionCompressed[];
	mirror?: true;
	pointType?: string;
};
export type LayerImageOverride = { image: string; condition: Condition; };
export type LayerImageOverrideCompressed = ArrayCompressType<LayerImageOverride, ['image', 'condition'], { condition: ConditionCompressed; }>;
export const enum LayerPriority {
	BACKGROUND,
	BELOW_BODY,
	BODY,
	ABOVE_BODY,
	BELOW_ARMS,
	ARMS,
	ABOVE_ARMS,
	OVERLAY,
}
export const enum LayerMirror {
	NONE,
	/** Only imageOverrides are mirrored, points are selected */
	SELECT,
	/** Mirrors everything and creates the mirrored image */
	FULL,
}
export const enum LayerSide {
	LEFT,
	RIGHT,
}
export type LayerDefinition = Rectangle & {
	image: string;
	priority: LayerPriority;
	points: PointDefinition[];
	imageOverrides: LayerImageOverride[];
	mirror: LayerMirror;
	pointType?: string[];
	side?: LayerSide;
};
export type LayerDefinitionCompressed = {
	rect: RectangleCompressed;
	image: string;
	priority: LayerPriority;
	points: PointDefinitionCompressed[] | string;
	imageOverrides?: LayerImageOverrideCompressed[];
	pointType?: string[];
	mirror: LayerMirror;
};
export type AssetSourceType = 'asset';
export type AssetId = `${AssetSourceType}-${string}`;
export type AssetDefinitionCompressed = {
	id: AssetId;
	layers: LayerDefinitionCompressed[];
	description: string;
};
