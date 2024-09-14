import type { CoordinatesCompressed } from './common';
import type { BoneType } from './conditions';

export interface BoneDefinitionCompressed {
	pos?: CoordinatesCompressed;
	/** Offset relative to `x` and `y` which should be applied to UI handle. Happens before `parent` or `rotation` shifts. */
	uiPositionOffset?: readonly [x: number, y: number];
	mirror?: string;
	parent?: string;
	baseRotation?: number;
	type: BoneType;
}
