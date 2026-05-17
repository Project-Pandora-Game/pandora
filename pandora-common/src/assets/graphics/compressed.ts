import type { CoordinatesCompressed } from './common.ts';
import type { BoneType } from './conditions.ts';
import type { BoneDefinitionPoseTransform } from './graphics.ts';

export interface BoneDefinitionCompressed {
	pos?: CoordinatesCompressed;
	/** Offset relative to `x` and `y` which should be applied to UI handle. Happens before `parent` or `rotation` shifts. */
	uiPositionOffset?: readonly [x: number, y: number];
	mirror?: string;
	parent?: string;
	baseRotation?: number;
	poseTransforms?: BoneDefinitionPoseTransform[];
	type: BoneType;
}
