import type { ArrayCompressType } from '../../utility';
import type { BoneType, Condition, ConditionOperator, CoordinatesCompressed, LayerImageOverride, LayerMirror, LayerPriority, PointDefinition, Size, TransformDefinition } from './graphics';

export type SizeCompressed = ArrayCompressType<Size, ['width', 'height']>;

export type RectangleCompressed = [...CoordinatesCompressed, ...SizeCompressed];

export type AtomicConditionCompressed = [string, ConditionOperator, number | string];

export type ConditionCompressed = AtomicConditionCompressed[][];

export function ExtractCondition(condition: ConditionCompressed): Condition {
	return condition?.map((segment) => segment.map(([bone, operator, value]) => typeof value === 'number' ? ({ bone, operator, value }) : ({ module: bone, operator, value })));
}

export type TransformDefinitionCompressed =
	['rotate', string, number, ConditionCompressed?] |
	['const-rotate', string, number, ConditionCompressed?] |
	['shift', string, CoordinatesCompressed, ConditionCompressed?] |
	['const-shift', CoordinatesCompressed, ConditionCompressed?];

export function ExtractTransformDefinition(trans: TransformDefinitionCompressed): TransformDefinition {
	if (trans[0] === 'const-shift') {
		return { type: 'const-shift', value: { x: trans[1][0], y: trans[1][1] }, condition: trans[2] && ExtractCondition(trans[2]) };
	}
	const [type, bone, , compressedCond] = trans;
	const condition = compressedCond && ExtractCondition(compressedCond);
	let transform: TransformDefinition;
	switch (type) {
		case 'const-rotate':
		case 'rotate':
			transform = { type, bone, condition, value: trans[2] };
			break;
		case 'shift':
			transform = { type, bone, condition, value: { x: trans[2][0], y: trans[2][1] } };
			break;
	}
	return transform;
}

export interface BoneDefinitionCompressed {
	pos?: CoordinatesCompressed;
	mirror?: string;
	parent?: string;
	baseRotation?: number;
	type: BoneType;
}

export type PointDefinitionCompressed = {
	pos: CoordinatesCompressed;
	transforms?: TransformDefinitionCompressed[];
	mirror?: true;
	pointType?: string;
};

export function ExtractPointDefinition({ pos, pointType, transforms = [], mirror }: PointDefinitionCompressed): PointDefinition {
	return {
		pos,
		transforms: transforms.map((trans) => ExtractTransformDefinition(trans)),
		mirror: mirror === true,
		pointType,
	};
}

export type LayerImageOverrideCompressed = ArrayCompressType<LayerImageOverride, ['image', 'condition'], { condition: ConditionCompressed; }>;

export function ExtractLayerImageOverride([image, condition]: LayerImageOverrideCompressed): LayerImageOverride {
	return {
		image,
		condition: ExtractCondition(condition),
	};
}

export type LayerDefinitionCompressed = {
	rect: RectangleCompressed;
	name?: string;
	image: string;
	priority: LayerPriority;
	points: PointDefinitionCompressed[] | number;
	imageOverrides?: LayerImageOverrideCompressed[];
	pointType?: string[];
	mirror: LayerMirror;
};

export type AssetGraphicsDefinitionCompressed = {
	layers: LayerDefinitionCompressed;
};
