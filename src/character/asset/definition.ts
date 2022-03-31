import type { ArrayCompressType } from '../../utility';

export type Coordinates = { x: number, y: number; };
export type CoordinatesCompressed = ArrayCompressType<Coordinates, ['x', 'y']>;

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
}
export type PointDefinitionCompressed = {
	pos: CoordinatesCompressed;
	transforms?: TransformDefinitionCompressed[];
	mirror?: true;
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
export type LayerDefinition = {
	image: string;
	priority: LayerPriority;
	points: PointDefinition[];
	imageOverrides: LayerImageOverride[];
};
export type LayerDefinitionCompressed = {
	image: string;
	priority: LayerPriority;
	points: PointDefinitionCompressed[];
	imageOverrides?: LayerImageOverrideCompressed[];
};
export type AssetSourceType = 'asset';
export type AssetId = `${AssetSourceType}-${string}`;
export type AssetDefinitionCompressed = {
	id: AssetId;
	layers: LayerDefinitionCompressed[];
	description: string;
};
