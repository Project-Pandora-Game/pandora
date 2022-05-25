import type { ArrayCompressType } from '../../utility';
import type { AssetId } from '../definitions';

export type Coordinates = { x: number, y: number; };
export type CoordinatesCompressed = ArrayCompressType<Coordinates, ['x', 'y']>;

export type Size = { width: number, height: number; };

export const CharacterSize = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	WIDTH: 1000,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	HEIGHT: 1500,
} as const;

export type Rectangle = Coordinates & Size;

export type ConditionOperator = '=' | '<' | '<=' | '>' | '>=' | '!=';
export interface AtomicCondition {
	bone: string;
	operator: ConditionOperator;
	value: number;
}

export type Condition = AtomicCondition[][];

export type TransformDefinition = { bone: string; condition?: Condition; } & ({
	type: 'rotate';
	value: number;
} | {
	type: 'shift';
	value: Coordinates;
});

export interface BoneDefinition {
	name: string;
	x: number;
	y: number;
	mirror?: BoneDefinition;
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

export type LayerImageOverride = { image: string; condition: Condition; };
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
	name?: string;
	image: string;
	priority: LayerPriority;
	points: PointDefinition[] | number;
	imageOverrides: LayerImageOverride[];
	pointType?: string[];
	mirror: LayerMirror;
};

export type AssetGraphicsDefinition = {
	layers: LayerDefinition[];
};

export interface AssetsGraphicsDefinitionFile {
	assets: Record<AssetId, AssetGraphicsDefinition>;
}
