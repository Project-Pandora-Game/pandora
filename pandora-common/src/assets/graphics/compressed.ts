import type { CoordinatesCompressed } from './common';
import type { BoneType } from './conditions';

export interface BoneDefinitionCompressed {
	pos?: CoordinatesCompressed;
	mirror?: string;
	parent?: string;
	baseRotation?: number;
	type: BoneType;
}
